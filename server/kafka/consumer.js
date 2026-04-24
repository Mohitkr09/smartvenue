// server/kafka/consumer.js

require("dotenv").config(); // ✅ MUST BE FIRST

const { Kafka, logLevel } = require("kafkajs");

// ==============================
// 🧠 KAFKA CONFIG
// ==============================

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

console.log("🔥 ENV KAFKA_BROKER =", process.env.KAFKA_BROKER);
console.log("🔥 USING BROKER =", BROKER);

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,

  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

// ==============================
// 🧠 STATE
// ==============================

let consumer = null;
let isRunning = false;
let isConnecting = false;

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
// 🚀 START CONSUMER
// ==============================

const startConsumer = async (io) => {
  if (isRunning || isConnecting) {
    console.log("⚠️ Consumer already running/connecting");
    return;
  }

  try {
    isConnecting = true;

    console.log("🔥 Starting Kafka Consumer...");
    console.log("📡 Broker:", BROKER);

    consumer = kafka.consumer({
      groupId: "zone-group",
    });

    // ==============================
    // 🔌 CONNECT
    // ==============================

    await consumer.connect();
    console.log("✅ Kafka Consumer Connected");

    // ==============================
    // 📡 SUBSCRIBE
    // ==============================

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    console.log("📡 Subscribed to topic: zone-updates");

    isRunning = true;
    isConnecting = false;

    // ==============================
    // 🔁 MESSAGE HANDLER
    // ==============================

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message?.value) return;

          const raw = message.value.toString();
          const data = safeParse(raw);

          if (!data) return;

          console.log("📊 Kafka Event:", data);

          // ==============================
          // 🧠 PROCESS DATA
          // ==============================

          const crowdLevel = Number(data.crowdLevel || 0);

          const processed = {
            ...data,
            crowdLevel,

            timestamp: new Date().toISOString(),

            waitTime:
              data.waitTime ??
              Math.max(1, Math.round(crowdLevel * 0.2)),

            suggestion:
              crowdLevel > 70
                ? "⚠️ Try another gate"
                : "✅ Best gate",

            alert:
              crowdLevel >= 85
                ? "🚨 High congestion"
                : null,
          };

          console.log("🧠 Processed:", processed);

          // ==============================
          // 📡 EMIT TO SOCKET
          // ==============================

          if (io) {
            io.emit("zoneUpdate", processed);
          } else {
            console.log("⚠️ Socket.io not available");
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

    // 🔁 Retry safely
    setTimeout(() => {
      console.log("🔄 Restarting Kafka Consumer...");
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
      console.log("🔌 Consumer Disconnected");
    }
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};

// ==============================
// 📤 EXPORTS
// ==============================

module.exports = {
  startConsumer,
  disconnectConsumer,
};