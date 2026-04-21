require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

// 🔥 REDIS (optional)
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

// 🔥 KAFKA
const { connectProducer, sendEvent } = require("./kafka/producer");
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
// 🌐 HEALTH CHECK (IMPORTANT)
// =======================
app.get("/", (req, res) => {
  res.send("🚀 Smart Venue API Running (Production)");
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
// 🌱 SEED DATA (SAFE)
// =======================
const seedZones = async () => {
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
};

// =======================
// 🔄 API ENDPOINTS
// =======================

// 🔥 Send event → Kafka
app.post("/zone", async (req, res) => {
  try {
    await sendEvent("zone-updates", req.body);

    res.json({
      success: true,
      message: "Event sent to Kafka",
    });
  } catch (err) {
    console.error("❌ Kafka Send Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 Get zones
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
// 🔥 REDIS SETUP (SAFE)
// =======================
async function setupRedis() {
  const redisUrl = process.env.REDIS_URI;

  if (!redisUrl) {
    console.log("⚠️ No Redis → skipping adapter");
    return;
  }

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
      console.log("Redis Error:", err.message)
    );

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    console.log("🔥 Redis Adapter Connected");
  } catch (err) {
    console.log("⚠️ Redis setup failed → fallback mode");
  }
}

// =======================
// 🔌 SOCKET EVENTS
// =======================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("updateZone", async (data) => {
    try {
      await sendEvent("zone-updates", data);
    } catch (err) {
      console.log("Socket Error:", err.message);
    }
  });

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
    await connectDB();

    await setupRedis();

    await connectProducer();
    console.log("🔥 Kafka Producer Connected");

    // ✅ CRITICAL: PUBLIC ACCESS FIX
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // ✅ NON-BLOCKING CONSUMER
    setTimeout(() => {
      console.log("🔥 Starting Kafka consumer...");
      startConsumer(io).catch((err) =>
        console.error("❌ Consumer crash:", err.message)
      );
    }, 1000);

  } catch (err) {
    console.error("❌ Startup Error:", err.message);
    process.exit(1);
  }
}

startServer();

// =======================
// 🛑 GLOBAL ERROR HANDLER
// =======================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});