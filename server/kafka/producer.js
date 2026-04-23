// server/kafka/producer.js

const { Kafka, logLevel } = require("kafkajs");

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

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
// 🚀 PRODUCER
// ==============================

const producer = kafka.producer({
  allowAutoTopicCreation: true,
});

let isConnected = false;
let isConnecting = false;

// ==============================
// 🔌 CONNECT PRODUCER (SAFE)
// ==============================

const connectProducer = async () => {
  if (isConnected) return;
  if (isConnecting) return;

  try {
    isConnecting = true;

    console.log("🔌 Connecting Kafka Producer...");
    console.log("📡 Broker:", BROKER);

    await producer.connect();

    isConnected = true;
    isConnecting = false;

    console.log("✅ Kafka Producer Connected");

  } catch (err) {
    isConnecting = false;
    console.error("❌ Kafka Connection Error:", err.message);

    // 🔁 Retry connection (non-blocking)
    setTimeout(() => {
      console.log("🔄 Retrying Kafka connection...");
      connectProducer();
    }, 5000);
  }
};

// ==============================
// 🔁 RETRY WRAPPER (SAFE)
// ==============================

const retrySend = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      console.log("🔁 Retrying Kafka send...");
      return retrySend(fn, retries - 1);
    }
    throw err;
  }
};

// ==============================
// 📤 SEND EVENT (NON-BLOCKING)
// ==============================

const sendEvent = async (topic, data) => {
  try {
    // 🔴 Don't block API if Kafka is down
    if (!isConnected) {
      connectProducer(); // async retry
      console.log("⚠️ Kafka not ready → skipping send");
      return;
    }

    if (!data) {
      console.warn("⚠️ Empty data skipped");
      return;
    }

    const message = {
      key: String(data.gate_id || "default"),
      value: JSON.stringify(data),
      timestamp: Date.now().toString(),
    };

    await retrySend(() =>
      producer.send({
        topic,
        messages: [message],
        acks: 1, // safer for single broker
      })
    );

    console.log(`📤 Kafka [${topic}] →`, data);

  } catch (err) {
    console.error("❌ Kafka Send Error:", err.message);
  }
};

// ==============================
// 📦 BATCH SEND
// ==============================

const sendBatchEvents = async (topic, events = []) => {
  try {
    if (!isConnected) {
      connectProducer();
      console.log("⚠️ Kafka not ready → skipping batch");
      return;
    }

    if (!events.length) return;

    const messages = events.map((data) => ({
      key: String(data.gate_id || "default"),
      value: JSON.stringify(data),
      timestamp: Date.now().toString(),
    }));

    await retrySend(() =>
      producer.send({
        topic,
        messages,
        acks: 1,
      })
    );

    console.log(`📦 Batch sent (${events.length}) → ${topic}`);

  } catch (err) {
    console.error("❌ Batch Send Error:", err.message);
  }
};

// ==============================
// 🔌 DISCONNECT
// ==============================

const disconnectProducer = async () => {
  try {
    if (isConnected) {
      await producer.disconnect();
      isConnected = false;
      console.log("🔌 Kafka Producer Disconnected");
    }
  } catch (err) {
    console.error("❌ Kafka Disconnect Error:", err.message);
  }
};

// ==============================
// 🧪 HEALTH CHECK
// ==============================

const isProducerHealthy = () => isConnected;

// ==============================
// 📤 EXPORTS
// ==============================

module.exports = {
  connectProducer,
  sendEvent,
  sendBatchEvents,
  disconnectProducer,
  isProducerHealthy,
};