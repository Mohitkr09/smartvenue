// server/kafka/producer.js

require("dotenv").config();

const { Kafka, logLevel, CompressionTypes } = require("kafkajs");
const fs = require("fs");

// ==============================
// 🧠 CONFIG
// ==============================

const BROKER = process.env.KAFKA_BROKER;
const CLIENT_ID = "smart-venue";

// OPTIONAL (for cloud Kafka like Confluent/MSK)
const USE_SSL = process.env.KAFKA_SSL === "true";
const SASL_USERNAME = process.env.KAFKA_USERNAME;
const SASL_PASSWORD = process.env.KAFKA_PASSWORD;

console.log("🔥 Kafka Broker:", BROKER);

// ==============================
// 🧠 INIT KAFKA
// ==============================

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,

  ssl: USE_SSL,

  sasl: SASL_USERNAME
    ? {
        mechanism: "plain",
        username: SASL_USERNAME,
        password: SASL_PASSWORD,
      }
    : undefined,

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

// ==============================
// 📦 QUEUE (PERSISTENT)
// ==============================

let messageQueue = [];
const MAX_QUEUE_SIZE = 2000;
const QUEUE_FILE = "./kafka-queue.json";

// ==============================
// 💾 LOAD QUEUE (RECOVERY)
// ==============================

const loadQueue = () => {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = fs.readFileSync(QUEUE_FILE);
      messageQueue = JSON.parse(data);
      console.log(`📦 Loaded ${messageQueue.length} queued messages`);
    }
  } catch (err) {
    console.log("❌ Queue load error:", err.message);
  }
};

// ==============================
// 💾 SAVE QUEUE
// ==============================

const saveQueue = () => {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(messageQueue));
  } catch (err) {
    console.log("❌ Queue save error:", err.message);
  }
};

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

    await flushQueue();

  } catch (err) {
    isConnecting = false;

    console.error("❌ Kafka Connect Error:", err.message);

    setTimeout(connectProducer, 5000);
  }
};

// ==============================
// 🔁 FLUSH QUEUE (BATCH)
// ==============================

const flushQueue = async () => {
  if (!isConnected || messageQueue.length === 0) return;

  console.log(`📤 Flushing ${messageQueue.length} queued events`);

  const batch = messageQueue.splice(0, 100); // send 100 at a time

  try {
    await producer.send({
      topic: "zone-updates",
      messages: batch,
      compression: CompressionTypes.GZIP,
      acks: 1,
    });

    saveQueue();

    if (messageQueue.length > 0) {
      setTimeout(flushQueue, 1000);
    }

  } catch (err) {
    console.error("❌ Flush Error:", err.message);

    messageQueue = [...batch, ...messageQueue];
    saveQueue();
  }
};

// ==============================
// 🔁 RETRY SEND
// ==============================

const retrySend = async (fn, retries = 3) => {
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

    // 🔥 If not connected → queue
    if (!isConnected) {
      if (messageQueue.length < MAX_QUEUE_SIZE) {
        messageQueue.push(message);
        saveQueue();
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
      saveQueue();
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
// 🛑 SHUTDOWN
// ==============================

process.on("SIGINT", async () => {
  console.log("🛑 Shutting down producer...");
  saveQueue();
  await disconnectProducer();
  process.exit(0);
});

// ==============================
// 🚀 INIT
// ==============================

loadQueue();
connectProducer();

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