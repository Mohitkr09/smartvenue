// server/kafka/producer.js

const { Kafka, logLevel } = require("kafkajs");

// ==============================
// 🧠 KAFKA SETUP
// ==============================

const kafka = new Kafka({
  clientId: "smart-venue",
  brokers: ["localhost:9092"],
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 100,
    retries: 5,
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
  if (isConnected || isConnecting) return;

  try {
    isConnecting = true;

    await producer.connect();

    isConnected = true;
    isConnecting = false;

    console.log("📡 Kafka Producer Connected");

  } catch (err) {
    isConnecting = false;
    console.error("❌ Kafka Connection Error:", err.message);
  }
};

// ==============================
// 🔁 RETRY WRAPPER
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
// 📤 SEND EVENT
// ==============================

const sendEvent = async (topic, data) => {
  try {
    if (!isConnected) {
      await connectProducer();
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
        acks: -1, // wait for all replicas
      })
    );

    console.log(`📤 Kafka [${topic}] →`, data);

  } catch (err) {
    console.error("❌ Kafka Send Error:", err.message);
  }
};

// ==============================
// 📦 BATCH SEND (OPTIMIZED)
// ==============================

const sendBatchEvents = async (topic, events = []) => {
  try {
    if (!isConnected) {
      await connectProducer();
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
        acks: -1,
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

const isProducerHealthy = () => {
  return isConnected;
};

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