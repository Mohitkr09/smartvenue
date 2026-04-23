// server/kafka/consumer.js

const { Kafka } = require("kafkajs");

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: [BROKER],

  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

let consumer = null;
let isRunning = false;

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
// 🚀 START CONSUMER (SAFE)
// ==============================

const startConsumer = async (io) => {
  if (isRunning) {
    console.log("⚠️ Consumer already running");
    return;
  }

  try {
    console.log("🔥 Starting Kafka Consumer...");
    console.log("📡 Broker:", BROKER);

    consumer = kafka.consumer({
      groupId: "zone-group",
    });

    await consumer.connect();
    console.log("✅ Kafka Consumer Connected");

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    console.log("📡 Subscribed to topic: zone-updates");

    isRunning = true;

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const raw = message.value.toString();
          const data = safeParse(raw);

          if (!data) return;

          console.log("📊 Kafka Event:", data);

          // ==============================
          // 🧠 PROCESSING LOGIC
          // ==============================

          const processed = {
            ...data,
            timestamp: new Date().toISOString(),

            waitTime:
              data.waitTime ??
              Math.max(1, Math.round((data.crowdLevel || 0) * 0.2)),

            suggestion:
              data.crowdLevel > 70
                ? "⚠️ Try another gate"
                : "✅ Best gate",

            alert:
              data.crowdLevel >= 85
                ? "🚨 High congestion"
                : null,
          };

          console.log("🧠 Processed:", processed);

          // ==============================
          // 📡 REAL-TIME EMIT
          // ==============================

          if (io) {
            io.emit("zoneUpdate", processed);
            console.log("📤 Emitted to frontend");
          }

        } catch (err) {
          console.log("❌ Message Processing Error:", err.message);
        }
      },
    });

  } catch (err) {
    console.log("❌ Consumer Error:", err.message);
    isRunning = false;

    // 🔁 Retry after delay (non-blocking)
    setTimeout(() => {
      console.log("🔄 Retrying Kafka Consumer...");
      startConsumer(io);
    }, 5000);
  }
};

// ==============================
// 🔌 CLEANUP
// ==============================

const disconnectConsumer = async () => {
  try {
    if (consumer) {
      await consumer.disconnect();
      isRunning = false;
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