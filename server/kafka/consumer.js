require("dotenv").config();

const { Kafka, logLevel } = require("kafkajs");
const axios = require("axios");

// ==============================
// CONFIG
// ==============================

const BROKER =
  process.env.KAFKA_BROKER || "localhost:9092";

const KAFKA_TOPIC =
  process.env.KAFKA_TOPIC || "zone-updates";

const KAFKA_GROUP =
  process.env.KAFKA_GROUP || "smartvenue-zone-consumer";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  "http://127.0.0.1:5000";

console.log("========================================");
console.log("🚀 SmartVenue Kafka Consumer");
console.log("========================================");
console.log("🔥 Kafka Broker:", BROKER);
console.log("📡 Kafka Topic:", KAFKA_TOPIC);
console.log("👥 Consumer Group:", KAFKA_GROUP);
console.log("🌐 Backend:", BACKEND_URL);
console.log("========================================");

// ==============================
// KAFKA
// ==============================

const kafka = new Kafka({
  clientId: "smart-venue-consumer",

  brokers: [BROKER],

  logLevel: logLevel.NOTHING,
});

// ==============================
// STATE
// ==============================

let consumer = null;

let isRunning = false;

let isConnecting = false;

// ==============================
// SAFE JSON PARSER
// ==============================

const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.log(
      "⚠️ Invalid JSON received from Kafka"
    );

    return null;
  }
};

// ==============================
// NORMALIZE GATE ID
// ==============================

const normalizeGateId = (gateId) => {
  if (gateId === undefined || gateId === null) {
    return null;
  }

  let id = String(gateId).trim();

  if (!id) {
    return null;
  }

  /*
    Supported:

    A
    B
    C
    D

    Gate A
    Gate B
    Gate C
    Gate D
  */

  if (
    id.toLowerCase().startsWith("gate ")
  ) {
    return id.substring(5).trim();
  }

  return id;
};

// ==============================
// VALIDATE DATA
// ==============================

const validateData = (data) => {
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      error: "Invalid message",
    };
  }

  const gateId =
    normalizeGateId(data.gate_id);

  if (!gateId) {
    return {
      valid: false,
      error: "gate_id is missing",
    };
  }

  const crowdLevel =
    Number(data.crowdLevel);

  const waitTime =
    Number(data.waitTime ?? 0);

  if (Number.isNaN(crowdLevel)) {
    return {
      valid: false,
      error: "crowdLevel must be a number",
    };
  }

  if (Number.isNaN(waitTime)) {
    return {
      valid: false,
      error: "waitTime must be a number",
    };
  }

  return {
    valid: true,

    data: {
      gate_id: gateId,

      crowdLevel: Math.max(
        0,
        Math.min(100, crowdLevel)
      ),

      waitTime: Math.max(
        0,
        waitTime
      ),

      device_id:
        data.device_id ||
        "kafka-device",

      timestamp:
        data.timestamp ||
        new Date().toISOString(),
    },
  };
};

// ==============================
// SEND DATA TO BACKEND
// ==============================

const sendToBackend = async (data) => {
  try {
    console.log(
      `📡 Sending ${data.gate_id} to backend...`
    );

    const response =
      await axios.post(
        `${BACKEND_URL}/iot-data`,
        data,
        {
          timeout: 8000,

          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

    console.log(
      `✅ Backend accepted Gate ${data.gate_id}`
    );

    return response.data;
  } catch (err) {
    if (err.response) {
      console.log(
        "❌ Backend error:",
        err.response.status,
        err.response.data
      );
    } else {
      console.log(
        "❌ Backend connection error:",
        err.message
      );
    }

    throw err;
  }
};

// ==============================
// PROCESS KAFKA MESSAGE
// ==============================

const processMessage = async (
  message
) => {
  try {
    if (!message?.value) {
      return;
    }

    const rawData =
      message.value.toString();

    console.log(
      "\n📥 Kafka message:",
      rawData
    );

    const data =
      safeParse(rawData);

    if (!data) {
      return;
    }

    // ------------------------------
    // VALIDATE
    // ------------------------------

    const validation =
      validateData(data);

    if (!validation.valid) {
      console.log(
        "⚠️ Invalid Kafka data:",
        validation.error
      );

      return;
    }

    const cleanData =
      validation.data;

    console.log(
      "✅ Clean data:",
      cleanData
    );

    // ------------------------------
    // SEND TO EXPRESS BACKEND
    // ------------------------------

    await sendToBackend(
      cleanData
    );

    console.log(
      `📤 Gate ${cleanData.gate_id} processed successfully`
    );
  } catch (err) {
    console.log(
      "❌ Message processing error:",
      err.message
    );

    /*
      Throwing the error allows KafkaJS
      to handle the failed message according
      to its consumer behavior.
    */

    throw err;
  }
};

// ==============================
// START CONSUMER
// ==============================

const startConsumer = async () => {
  if (
    isRunning ||
    isConnecting
  ) {
    console.log(
      "⚠️ Consumer already running/connecting"
    );

    return;
  }

  try {
    isConnecting = true;

    // ------------------------------
    // CREATE CONSUMER
    // ------------------------------

    consumer =
      kafka.consumer({
        groupId: KAFKA_GROUP,

        // Prevent one slow message from
        // causing unnecessary rebalancing
        sessionTimeout: 30000,

        heartbeatInterval: 3000,
      });

    // ------------------------------
    // CONNECT
    // ------------------------------

    await consumer.connect();

    console.log(
      "✅ Kafka connected"
    );

    // ------------------------------
    // SUBSCRIBE
    // ------------------------------

    await consumer.subscribe({
      topic: KAFKA_TOPIC,

      fromBeginning: false,
    });

    console.log(
      `📡 Subscribed to ${KAFKA_TOPIC}`
    );

    isRunning = true;

    isConnecting = false;

    // ------------------------------
    // RUN
    // ------------------------------

    await consumer.run({
      autoCommit: true,

      eachMessage: async ({
        topic,
        partition,
        message,
      }) => {
        console.log(
          `\n📨 Topic: ${topic}`
        );

        console.log(
          `📍 Partition: ${partition}`
        );

        console.log(
          `🔢 Offset: ${message.offset}`
        );

        await processMessage(
          message
        );
      },
    });
  } catch (err) {
    console.log(
      "❌ Kafka Consumer Error:",
      err.message
    );

    isRunning = false;

    isConnecting = false;

    consumer = null;

    // ------------------------------
    // AUTO RESTART
    // ------------------------------

    console.log(
      "🔄 Consumer restarting in 5 seconds..."
    );

    setTimeout(() => {
      startConsumer();
    }, 5000);
  }
};

// ==============================
// DISCONNECT
// ==============================

const disconnectConsumer =
  async () => {
    try {
      if (consumer) {
        await consumer.disconnect();

        console.log(
          "🔌 Kafka consumer disconnected"
        );
      }

      consumer = null;

      isRunning = false;

      isConnecting = false;
    } catch (err) {
      console.log(
        "❌ Consumer disconnect error:",
        err.message
      );
    }
  };

// ==============================
// GRACEFUL SHUTDOWN
// ==============================

process.on(
  "SIGINT",
  async () => {
    console.log(
      "\n🛑 Shutting down..."
    );

    await disconnectConsumer();

    process.exit(0);
  }
);

process.on(
  "SIGTERM",
  async () => {
    console.log(
      "\n🛑 SIGTERM received..."
    );

    await disconnectConsumer();

    process.exit(0);
  }
);

// ==============================
// START WHEN FILE IS RUN DIRECTLY
// ==============================

if (
  require.main === module
) {
  startConsumer();
}

// ==============================
// EXPORT
// ==============================

module.exports = {
  startConsumer,
  disconnectConsumer,
};