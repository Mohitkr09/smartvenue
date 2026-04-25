require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");

// 🔥 REDIS
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

// 🔥 KAFKA
const { connectProducer } = require("./kafka/producer");
const { startConsumer } = require("./kafka/consumer");

// Models
const Zone = require("./models/Zone");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

// =======================
// 🔔 PUSH TOKENS (TEMP)
// =======================
let pushTokens = [];

const app = express();

// =======================
// 🔧 MIDDLEWARE
// =======================
app.use(
  cors({
    origin: "*", // 🔥 allow mobile easily
    methods: ["GET", "POST"],
  })
);

app.use(express.json());
app.use(morgan("dev"));

// =======================
// 🔄 ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// =======================
// 🔔 SAVE TOKEN
// =======================
app.post("/save-token", (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ msg: "No token" });
    }

    if (!pushTokens.includes(token)) {
      pushTokens.push(token);
    }

    console.log("📱 Total Tokens:", pushTokens.length);

    res.json({ success: true });
  } catch (err) {
    console.log("❌ Token Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 🌐 HEALTH
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "Smart Venue API",
  });
});

// =======================
// 🔌 DATABASE
// =======================
async function connectDB() {
  try {
    console.log("🔌 Connecting MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    await seedZones();
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  }
}

// =======================
// 🌱 SEED
// =======================
async function seedZones() {
  try {
    const zones = [
      { name: "Gate A", lat: 25.4484, lng: 78.5685 },
      { name: "Gate B", lat: 25.4490, lng: 78.5690 },
      { name: "Gate C", lat: 25.4475, lng: 78.5670 },
      { name: "VIP Gate", lat: 25.4500, lng: 78.5700 },
      { name: "Food Entry", lat: 25.4465, lng: 78.5660 },
    ];

    for (let z of zones) {
      await Zone.findOneAndUpdate(
        { name: z.name },
        {
          ...z,
          crowdLevel: Math.floor(Math.random() * 50),
          waitTime: Math.floor(Math.random() * 5),
        },
        { upsert: true }
      );
    }

    console.log("✅ Zones Seeded");
  } catch (err) {
    console.log("⚠️ Seed skipped:", err.message);
  }
}

// =======================
// 🔄 ZONES API
// =======================
app.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find();
    res.json(zones);
  } catch (err) {
    console.error("❌ Zones Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 🔌 SOCKET
// =======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// =======================
// 🔥 REDIS (OPTIONAL)
// =======================
async function setupRedis() {
  const redisUrl =
    process.env.REDIS_URL || process.env.REDIS_URI;

  if (!redisUrl) {
    console.log("⚠️ Redis not configured");
    return;
  }

  try {
    console.log("🔌 Connecting Redis...");

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    console.log("🔥 Redis Connected");
  } catch (err) {
    console.log("⚠️ Redis failed:", err.message);
  }
}

// =======================
// 🔌 SOCKET EVENTS
// =======================
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

// =======================
// 🚀 START SERVER
// =======================
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("🚀 Starting server...");

    await connectDB();
    await setupRedis();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Running on port ${PORT}`);
    });

    // ===============================
    // 🔥 KAFKA (FIXED)
    // ===============================
    const BROKER = process.env.KAFKA_BROKER;

    if (BROKER) {
      console.log("📡 Kafka ENABLED");

      connectProducer();

      setTimeout(() => {
        startConsumer(io);
      }, 2000);
    } else {
      console.log("⚠️ Kafka not configured");
    }

  } catch (err) {
    console.error("❌ Startup Error:", err.message);
    process.exit(1);
  }
}

startServer();

// =======================
// 🛑 ERROR HANDLING
// =======================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Rejection:", err);
});

// =======================
// 📤 EXPORT
// =======================
module.exports = {
  pushTokens,
};