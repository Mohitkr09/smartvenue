// server/kafka/producer.js

require("dotenv").config();

const { Kafka, logLevel, CompressionTypes } = require("kafkajs");

// ==============================
// 🧠 CONFIG
// ==============================

const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

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
// 🚀 PRODUCER
// ==============================

const producer = kafka.producer({
  allowAutoTopicCreation: true,
});

// ==============================
// 🧠 STATE
// ==============================

let isConnected = false;
let isConnecting = false;

// 🔥 QUEUE (prevents data loss)
let messageQueue = [];
const MAX_QUEUE_SIZE = 1000;

// ==============================
// 🔌 CONNECT
// ==============================

const connectProducer = async () => {
  if (isConnected || isConnecting) return;

  try {
    isConnecting = true;

    console.log("🔌 Connecting Kafka Producer...");

    await producer.connect();

    isConnected = true;
    isConnecting = false;

    console.log("✅ Kafka Producer Connected");

    // 🔥 flush queued messages
    await flushQueue();

  } catch (err) {
    isConnecting = false;

    console.error("❌ Kafka Connection Error:", err.message);

    setTimeout(connectProducer, 5000);
  }
};

// ==============================
// 🔁 FLUSH QUEUE
// ==============================

const flushQueue = async () => {
  if (!isConnected || messageQueue.length === 0) return;

  console.log(`📤 Flushing ${messageQueue.length} queued events`);

  const batch = [...messageQueue];
  messageQueue = [];

  try {
    await producer.send({
      topic: "zone-updates",
      messages: batch,
      compression: CompressionTypes.GZIP,
      acks: 1,
    });

  } catch (err) {
    console.error("❌ Queue flush error:", err.message);

    // 🔁 restore queue
    messageQueue = [...batch, ...messageQueue];
  }
};

// ==============================
// 🔁 RETRY
// ==============================

const retrySend = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      console.log("🔁 Retrying send...");
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
    if (!data || typeof data !== "object") {
      console.warn("⚠️ Invalid data skipped");
      return;
    }

    const message = {
      key: String(data.gate_id || "default"),
      value: JSON.stringify(data),
      timestamp: Date.now().toString(),
    };

    // 🔥 If not connected → queue instead of skipping
    if (!isConnected) {
      if (messageQueue.length < MAX_QUEUE_SIZE) {
        messageQueue.push(message);
      } else {
        console.warn("⚠️ Queue full, dropping event");
      }

      connectProducer();
      return;
    }

    await retrySend(() =>
      producer.send({
        topic,
        messages: [message],
        compression: CompressionTypes.GZIP,
        acks: 1,
      })
    );

    console.log(`📤 Kafka [${topic}] →`, data);

  } catch (err) {
    console.error("❌ Send Error:", err.message);
  }
};

// ==============================
// 📦 BATCH SEND
// ==============================

const sendBatchEvents = async (topic, events = []) => {
  try {
    if (!Array.isArray(events) || events.length === 0) return;

    const messages = events.map((data) => ({
      key: String(data?.gate_id || "default"),
      value: JSON.stringify(data || {}),
      timestamp: Date.now().toString(),
    }));

    if (!isConnected) {
      messageQueue.push(...messages);
      connectProducer();
      return;
    }

    await retrySend(() =>
      producer.send({
        topic,
        messages,
        compression: CompressionTypes.GZIP,
        acks: 1,
      })
    );

    console.log(`📦 Batch sent (${events.length})`);

  } catch (err) {
    console.error("❌ Batch Error:", err.message);
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
      console.log("🔌 Producer Disconnected");
    }
  } catch (err) {
    console.error("❌ Disconnect Error:", err.message);
  }
};

// ==============================
// 🧪 HEALTH
// ==============================

const isProducerHealthy = () => isConnected;

// ==============================
// 🛑 GRACEFUL SHUTDOWN
// ==============================

process.on("SIGINT", async () => {
  console.log("🛑 Shutting down producer...");
  await disconnectProducer();
  process.exit(0);
});

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