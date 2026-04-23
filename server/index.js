require("dotenv").config(); // ✅ MUST BE FIRST

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

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

const app = express();

// =======================
// 🔧 MIDDLEWARE
// =======================
app.use(cors({ origin: "*" }));
app.use(express.json());

// =======================
// 🔄 ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// =======================
// 🌐 HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.send("🚀 Smart Venue API Running");
});

// =======================
// 🔌 DATABASE
// =======================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    await seedZones();
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  }
}

// =======================
// 🌱 SEED DATA
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
// 🔄 API ENDPOINTS
// =======================
app.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find();
    res.json(zones);
  } catch (err) {
    console.error("❌ Fetch Zones Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 🔄 SOCKET SERVER
// =======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// =======================
// 🔥 REDIS SETUP (FIXED)
// =======================
async function setupRedis() {
  const redisUrl =
    process.env.REDIS_URL || process.env.REDIS_URI; // ✅ FIXED

  if (!redisUrl) {
    console.log("⚠️ No Redis → skipping adapter");
    return;
  }

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
      console.log("❌ Redis Error:", err.message)
    );

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    console.log("🔥 Redis Adapter Connected");
  } catch (err) {
    console.log("⚠️ Redis failed → fallback mode:", err.message);
  }
}

// =======================
// 🔌 SOCKET EVENTS
// =======================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
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

    // ✅ START SERVER FIRST
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // 🔥 Kafka Producer (non-blocking)
    connectProducer().catch((err) =>
      console.log("⚠️ Kafka producer failed:", err.message)
    );

    // 🔥 Kafka Consumer (non-blocking + delayed)
    setTimeout(() => {
      startConsumer(io).catch((err) =>
        console.log("⚠️ Kafka consumer failed:", err.message)
      );
    }, 2000);

  } catch (err) {
    console.error("❌ Startup Error:", err.message);
    process.exit(1);
  }
}

startServer();

// =======================
// 🛑 GLOBAL ERROR HANDLING
// =======================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});