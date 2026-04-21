
// server/kafka/consumer.js

const { Kafka } = require("kafkajs");

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: ["localhost:9092"],
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
// 🚀 START CONSUMER
// ==============================

const startConsumer = async (io) => {
  try {
    console.log("🔥 Starting Kafka Consumer...");

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
          // 🧠 BASIC PROCESSING
          // ==============================

          const result = {
            ...data,
            timestamp: new Date().toISOString(),
            suggestion:
              data.crowdLevel > 70
                ? "⚠️ Try another gate"
                : "✅ Best gate",
          };

          // ==============================
          // 🚨 ALERT
          // ==============================

          result.alert =
            data.crowdLevel >= 85
              ? "🚨 High congestion"
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
    console.log("🔌 Consumer Disconnected");
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};

module.exports = {
  startConsumer,
  disconnectConsumer,
};

