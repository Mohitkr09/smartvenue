
// server/kafka/consumer.js

const { Kafka, logLevel } = require("kafkajs");
const axios = require("axios");
const redis = require("redis");

// ==============================
// 🔌 REDIS CLIENT (SAFE MODE)
// ==============================

let redisClient = null;

try {
  redisClient = redis.createClient();

  redisClient.on("error", (err) =>
    console.log("⚠️ Redis Error:", err.message)
  );

} catch (err) {
  console.log("⚠️ Redis init failed");
}

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const kafka = new Kafka({
  clientId: "analytics-service",
  brokers: ["localhost:9092"],
  logLevel: logLevel.NOTHING,
});

const consumer = kafka.consumer({ groupId: "zone-group" });

// ==============================
// 🔁 SAFE JSON PARSE
// ==============================

const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.log("❌ JSON Parse Error:", err.message);
    return null;
  }
};

// ==============================
// 🔁 AI SERVICE CALL (SAFE)
// ==============================

const callAIService = async (payload, retries = 2) => {
  try {
    const res = await axios.post(
      "http://localhost:7000/predict",
      payload,
      { timeout: 2000 }
    );

    return res.data?.data || {};
  } catch (err) {
    if (retries > 0) {
      console.log("🔁 Retrying AI...");
      return callAIService(payload, retries - 1);
    }

    console.log("⚠️ AI service not available");
    return {}; // fallback
  }
};

// ==============================
// 🧭 BEST GATE (SAFE)
// ==============================

const getBestGate = async () => {
  if (!redisClient || !redisClient.isOpen) return null;

  try {
    const keys = await redisClient.keys("zone:*");

    if (!keys.length) return null;

    const zones = await Promise.all(
      keys.map((k) => redisClient.get(k))
    );

    const parsed = zones
      .map((z) => {
        try {
          return JSON.parse(z);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    parsed.sort(
      (a, b) =>
        (a.futureCrowd || 100) - (b.futureCrowd || 100)
    );

    return parsed[0];
  } catch (err) {
    console.log("⚠️ Best Gate Error:", err.message);
    return null;
  }
};

// ==============================
// 🚀 START CONSUMER
// ==============================

const startConsumer = async (io) => {
  try {
    console.log("🚀 Starting Kafka Consumer...");

    // 🔥 Try Redis (optional)
    if (redisClient) {
      try {
        await redisClient.connect();
        console.log("⚡ Redis Connected");
      } catch {
        console.log("⚠️ Redis not available, skipping cache");
      }
    }

    // 🔥 Kafka connect
    await consumer.connect();
    console.log("📡 Kafka Consumer Connected");

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const raw = message.value.toString();
          const data = safeParse(raw);

          if (!data) return;

          console.log("📊 Kafka Event:", data);

          // ==============================
          // 🧠 AI PREDICTION
          // ==============================

          const prediction = await callAIService({
            crowd: data.crowdLevel,
            wait: data.waitTime,
            gate_id: data.name,
          });

          const result = {
            ...data,
            ...prediction,
            timestamp: new Date().toISOString(),
          };

          // ==============================
          // ⚡ REDIS STORE (OPTIONAL)
          // ==============================

          if (redisClient?.isOpen) {
            try {
              await redisClient.set(
                `zone:${result.name}`,
                JSON.stringify(result),
                { EX: 60 }
              );
            } catch {}
          }

          // ==============================
          // 🧭 BEST GATE
          // ==============================

          const bestGate = await getBestGate();

          if (bestGate) {
            result.suggestion =
              bestGate.name !== result.name
                ? `➡️ Use Gate ${bestGate.name}`
                : "✅ You are at best gate";
          } else {
            result.suggestion = "ℹ️ No recommendation";
          }

          // ==============================
          // 🚨 ALERT
          // ==============================

          result.alert =
            result.futureCrowd >= 85
              ? "🚨 High congestion expected"
              : null;

          // ==============================
          // 📡 REAL-TIME EMIT
          // ==============================

          if (io) {
            io.emit("zoneUpdated", result);
          }

          console.log("✅ Processed:", result);

        } catch (err) {
          console.log("❌ Message Error:", err.message);
        }
      },
    });

  } catch (err) {
    console.log("❌ Consumer Error:", err.message);
  }
};

// ==============================
// 🔌 CLEANUP
// ==============================

const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();

    if (redisClient?.isOpen) {
      await redisClient.quit();
    }

    console.log("🔌 Consumer Disconnected");
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};

module.exports = {
  startConsumer,
  disconnectConsumer,
};

