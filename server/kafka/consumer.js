require("dotenv").config();

const { Kafka, logLevel } = require("kafkajs");
const axios = require("axios");
const Redis = require("ioredis");
const mongoose = require("mongoose");

// ==============================
// 🧠 CONFIG
// ==============================

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";
const AI_URL = process.env.AI_URL || "http://localhost:7000/predict-zones";
const REDIS_URL = process.env.REDIS_URL;
const MONGO_URI = process.env.MONGO_URI;

console.log("🔥 Kafka:", BROKER);
console.log("🤖 AI:", AI_URL);

// ==============================
// 🧠 MONGO CONNECT
// ==============================

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(err => console.log("❌ Mongo Error:", err.message));

// ==============================
// 🧠 SCHEMA
// ==============================

const zoneLogSchema = new mongoose.Schema({
  gate_id: String,
  crowdLevel: Number,
  waitTime: Number,
  hour: Number,
  day: Number,
  timestamp: Date,
});

// ⚠️ IMPORTANT: collection name must match MongoDB EXACTLY
const ZoneLog = mongoose.model("zonelogs", zoneLogSchema);

// ==============================
// 🧠 KAFKA
// ==============================

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,
});

// ==============================
// 🧠 REDIS (SAFE)
// ==============================

let redis = null;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL, { tls: {} });

    redis.on("connect", () => console.log("✅ Redis Connected"));

    redis.on("error", (err) => {
      console.log("⚠️ Redis disabled:", err.message);
      redis = null;
    });

  } catch {
    console.log("⚠️ Redis not available");
  }
}

// ==============================
// 🧠 STATE
// ==============================

let consumer = null;
let isRunning = false;
let isConnecting = false;

let zoneBuffer = {};
let lastEmit = Date.now();
const EMIT_INTERVAL = 1500;

// ==============================
// 🔁 SAFE PARSE
// ==============================

const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// ==============================
// 🤖 CALL AI
// ==============================

const callAI = async (zones) => {
  try {
    const res = await axios.post(AI_URL, { zones }, { timeout: 3000 });

    console.log("🤖 AI Response:", res.data);

    return res.data?.data || zones;

  } catch (err) {
    console.log("⚠️ AI fallback:", err.message);
    return zones;
  }
};

// ==============================
// 📡 PROCESS & EMIT
// ==============================

const processAndEmit = async (io) => {
  try {
    const zones = Object.values(zoneBuffer);
    if (!zones.length) return;

    console.log("📊 Zones:", zones);

    const result = await callAI(zones);

    // Redis (optional)
    if (redis) {
      try {
        await redis.set("latest_zones", JSON.stringify(result), "EX", 10);
      } catch {}
    }

    // Socket
    if (io) {
      io.emit("zoneUpdate", result);
    }

    console.log("📤 Sent to app");

  } catch (err) {
    console.log("❌ Process Error:", err.message);
  }
};

// ==============================
// 🚀 START CONSUMER
// ==============================

const startConsumer = async (io) => {
  if (isRunning || isConnecting) return;

  try {
    isConnecting = true;

    consumer = kafka.consumer({ groupId: "zone-group" });

    await consumer.connect();
    console.log("✅ Kafka Connected");

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    console.log("📡 Subscribed to zone-updates");

    isRunning = true;
    isConnecting = false;

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message?.value) return;

          const data = safeParse(message.value.toString());
          if (!data) return;

          console.log("📥 Kafka:", data);

          const gateId = data.gate_id || "A";
          const now = new Date();

          // ==============================
          // 💾 SAVE TO MONGO (FIXED)
          // ==============================

          try {
            await ZoneLog.create({
              gate_id: gateId,
              crowdLevel: Number(data.crowdLevel || 0),
              waitTime: Number(data.waitTime || 0),
              hour: now.getHours(),
              day: now.getDay(),
              timestamp: now,
            });

            console.log("💾 Saved to Mongo:", gateId);

          } catch (err) {
            console.log("❌ Mongo Save Error:", err.message);
          }

          // ==============================
          // 🧠 BUFFER
          // ==============================

          zoneBuffer[gateId] = {
            id: gateId,
            crowdLevel: Number(data.crowdLevel || 0),
            waitTime: Number(data.waitTime || 0),
            distance: 100 + Math.floor(Math.random() * 200),
            hour: now.getHours(),
            day: now.getDay(),
          };

          // ==============================
          // ⏱ BATCH EMIT
          // ==============================

          if (Date.now() - lastEmit >= EMIT_INTERVAL) {
            await processAndEmit(io);
            zoneBuffer = {};
            lastEmit = Date.now();
          }

        } catch (err) {
          console.log("❌ Message Error:", err.message);
        }
      },
    });

  } catch (err) {
    console.log("❌ Consumer Error:", err.message);

    isRunning = false;
    isConnecting = false;

    setTimeout(() => {
      console.log("🔄 Restarting consumer...");
      startConsumer(io);
    }, 5000);
  }
};

// ==============================
// 🔌 DISCONNECT
// ==============================

const disconnectConsumer = async () => {
  try {
    if (consumer) {
      await consumer.disconnect();

      if (redis) await redis.quit();

      await mongoose.disconnect();

      console.log("🔌 Disconnected");

      consumer = null;
      isRunning = false;
      isConnecting = false;
    }
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};

// ==============================
// 📤 EXPORT
// ==============================

module.exports = {
  startConsumer,
  disconnectConsumer,
};