// server/kafka/consumer.js

const { Kafka } = require("kafkajs");

// ==============================
// 🧠 KAFKA SETUP (FIXED)
// ==============================

// ✅ Always fallback to localhost (important for EC2 host)
const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: [BROKER],

  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

const consumer = kafka.consumer({
  groupId: "zone-group",
});

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
  try {
    console.log("🔥 Starting Kafka Consumer...");
    console.log("📡 Using broker:", BROKER);

    await consumer.connect();
    console.log("✅ Kafka Consumer Connected");

    await consumer.subscribe({
      topic: "zone-updates",
      fromBeginning: false,
    });

    console.log("📡 Subscribed to topic: zone-updates");

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
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
          } else {
            console.log("⚠️ Socket.io not available");
          }

        } catch (err) {
          console.log("❌ Message Processing Error:", err.message);
        }
      },
    });

  } catch (err) {
    console.log("❌ Consumer Error:", err.message);

    // 🔁 AUTO RETRY (VERY IMPORTANT)
    setTimeout(() => {
      console.log("🔄 Restarting consumer...");
      startConsumer(io);
    }, 5000);
  }
};

// ==============================
// 🔌 CLEANUP
// ==============================

const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();
    console.log("🔌 Consumer Disconnected");
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};

module.exports = {
  startConsumer,
  disconnectConsumer,
};