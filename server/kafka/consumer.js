// server/kafka/consumer.js

const { Kafka } = require("kafkajs");

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
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

    await consumer.connect();
    console.log("📡 Kafka Consumer Connected");

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

            // fallback wait time
            waitTime:
              data.waitTime ??
              Math.max(1, Math.round(data.crowdLevel * 0.2)),

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
            console.log("📤 Emitting to frontend...");
            io.emit("zoneUpdate", processed); // ✅ MUST MATCH FRONTEND
          } else {
            console.log("⚠️ No socket instance");
          }

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