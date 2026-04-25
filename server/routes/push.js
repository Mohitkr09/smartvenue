let tokens = [];

module.exports = { tokens };// server/kafka/consumer.js

require("dotenv").config();

const { Kafka, logLevel } = require("kafkajs");
const sendPush = require("../utils/push");
const { tokens } = require("../routes/push");

// ==============================
// 🧠 KAFKA CONFIG
// ==============================

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

console.log("🔥 USING BROKER =", BROKER);

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,
});

// ==============================
// 🧠 STATE
// ==============================

let consumer = null;
let isRunning = false;
let isConnecting = false;

// 🔥 prevent spam
let lastPushTime = {};
const PUSH_COOLDOWN = 15000; // 15 sec

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
// 🚀 START CONSUMER
// ==============================

const startConsumer = async (io) => {
  if (isRunning || isConnecting) {
    console.log("⚠️ Consumer already running");
    return;
  }

  try {
    isConnecting = true;

    consumer = kafka.consumer({
      groupId: "zone-group",
    });

    await consumer.connect();
    console.log("✅ Kafka Connected");

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    isRunning = true;
    isConnecting = false;

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message?.value) return;

          const data = safeParse(message.value.toString());
          if (!data) return;

          const crowdLevel = Number(data.crowdLevel || 0);

          const processed = {
            ...data,
            crowdLevel,
            timestamp: new Date().toISOString(),

            waitTime: Math.max(1, Math.round(crowdLevel * 0.2)),

            suggestion:
              crowdLevel > 70
                ? "⚠️ Try another gate"
                : "✅ Best gate",

            alert:
              crowdLevel >= 85
                ? "🚨 High congestion"
                : null,
          };

          console.log("📊 Event:", processed);

          // ==============================
          // 📡 SOCKET EMIT
          // ==============================

          io?.emit("zoneUpdate", processed);

          // ==============================
          // 🔔 PUSH NOTIFICATION
          // ==============================

          if (!tokens.length) return;

          const now = Date.now();
          const key = processed.name || "default";

          // 🔥 prevent spam
          if (
            lastPushTime[key] &&
            now - lastPushTime[key] < PUSH_COOLDOWN
          ) {
            return;
          }

          let messageText = null;

          if (crowdLevel >= 85) {
            messageText = `🚨 ${processed.name} overcrowded!`;
          } else if (crowdLevel < 30) {
            messageText = `✅ ${processed.name} is free`;
          }

          if (!messageText) return;

          lastPushTime[key] = now;

          console.log("📤 Sending push:", messageText);

          await sendPush(tokens, messageText);

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
      consumer = null;
      isRunning = false;
      isConnecting = false;
      console.log("🔌 Consumer stopped");
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