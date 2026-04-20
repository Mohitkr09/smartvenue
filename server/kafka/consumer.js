// server/kafka/consumer.js

const { Kafka, logLevel } = require("kafkajs");
const axios = require("axios");
const redis = require("redis");

// ==============================
// 🔌 REDIS CLIENT
// ==============================

const redisClient = redis.createClient();

redisClient.on("error", (err) =>
  console.error("❌ Redis Error:", err.message)
);

redisClient.on("connect", () =>
  console.log("⚡ Redis Connected")
);

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const kafka = new Kafka({
  clientId: "analytics-service",
  brokers: ["localhost:9092"],
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
});

const consumer = kafka.consumer({ groupId: "zone-group" });

// ==============================
// 🔁 HELPER: SAFE JSON PARSE
// ==============================

const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// ==============================
// 🧭 HELPER: GET BEST GATE
// ==============================

const getBestGate = async () => {
  try {
    const keys = await redisClient.keys("zone:*");

    if (!keys.length) return null;

    const zones = await Promise.all(
      keys.map((k) => redisClient.get(k))
    );

    const parsed = zones
      .map(safeParse)
      .filter(Boolean);

    if (!parsed.length) return null;

    // sort by lowest future crowd
    parsed.sort(
      (a, b) =>
        (a.futureCrowd || 100) - (b.futureCrowd || 100)
    );

    return parsed[0];
  } catch (err) {
    console.error("❌ Best Gate Error:", err.message);
    return null;
  }
};

// ==============================
// 🔁 HELPER: CALL AI WITH RETRY
// ==============================

const callAIService = async (payload, retries = 2) => {
  try {
    const res = await axios.post(
      "http://localhost:7000/predict",
      payload,
      { timeout: 3000 }
    );

    return res.data.data;
  } catch (err) {
    if (retries > 0) {
      console.log("🔁 Retrying AI call...");
      return callAIService(payload, retries - 1);
    }
    throw err;
  }
};

// ==============================
// 🚀 START CONSUMER
// ==============================

const startConsumer = async (io) => {
  try {
    await redisClient.connect();

    await consumer.connect();
    console.log("📡 Kafka Consumer Connected");

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = safeParse(message.value.toString());

          if (!data) {
            console.warn("⚠️ Invalid Kafka message");
            return;
          }

          console.log("📊 Kafka Event:", data);

          // ==============================
          // 🧠 CALL AI SERVICE
          // ==============================

          const prediction = await callAIService({
            crowd: data.crowdLevel,
            wait: data.waitTime,
            gate_id: data.gate_id || data.name,
          });

          // ==============================
          // 🔥 MERGE DATA
          // ==============================

          const result = {
            ...data,
            ...prediction,
            timestamp: new Date().toISOString(),
          };

          // ==============================
          // ⚡ STORE IN REDIS (WITH TTL)
          // ==============================

          const redisKey = `zone:${result.gate_id}`;

          await redisClient.set(
            redisKey,
            JSON.stringify(result),
            { EX: 60 } // expire in 60 sec
          );

          // ==============================
          // 🧭 BEST GATE LOGIC
          // ==============================

          const bestGate = await getBestGate();

          if (bestGate) {
            result.suggestion =
              bestGate.gate_id !== result.gate_id
                ? `➡️ Use Gate ${bestGate.gate_id}`
                : "✅ You are at best gate";
          }

          // ==============================
          // 🚨 ALERT SYSTEM
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
          console.error("❌ Processing Error:", err.message);
        }
      },
    });

  } catch (err) {
    console.error("❌ Consumer Error:", err.message);
  }
};

// ==============================
// 🔌 GRACEFUL SHUTDOWN
// ==============================

const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();
    await redisClient.quit();
    console.log("🔌 Consumer Disconnected");
  } catch (err) {
    console.error("❌ Disconnect Error:", err.message);
  }
};

module.exports = {
  startConsumer,
  disconnectConsumer,
};