require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const axios = require("axios");

// Models
const Zone = require("./models/Zone");
const ZoneLog = require("./models/ZoneLog");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

// =======================
// 🔧 MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// =======================
// 🔄 ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// =======================
// 🤖 AI FUNCTION
// =======================
const getPrediction = async (zones) => {
  try {
    const res = await axios.post(
      process.env.AI_URL || "http://127.0.0.1:7000/predict-zones",
      { zones },
      { timeout: 2000 }
    );

    return res.data?.data || zones;
  } catch (err) {
    console.log("⚠️ AI fallback:", err.message);
    return zones;
  }
};

// =======================
// 🧭 ROUTE API
// =======================
app.post("/route", async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin?.lat || !destination?.lat) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
        timeout: 3000,
      }
    );

    res.json(response.data);
  } catch (err) {
    console.log("❌ Route error:", err.message);
    res.status(500).json({ error: "Route failed" });
  }
});

// =======================
// 📡 IoT DATA
// =======================
app.post("/iot-data", async (req, res) => {
  try {
    const { gate_id, crowdLevel, waitTime } = req.body;

    if (!gate_id) {
      return res.status(400).json({ error: "gate_id required" });
    }

    const now = new Date();

    const enriched = {
      device_id: req.body.device_id || "unknown",
      gate_id,
      crowdLevel: Number(crowdLevel || 0),
      waitTime: Number(waitTime || 1),
      hour: now.getHours(),
      day: now.getDay(),
      timestamp: now,
    };

    await ZoneLog.create(enriched);

    await Zone.findOneAndUpdate(
      { name: `Gate ${gate_id}` },
      {
        crowdLevel: enriched.crowdLevel,
        waitTime: enriched.waitTime,
      },
      { new: true }
    );

    const latest = await ZoneLog.find()
      .sort({ timestamp: -1 })
      .limit(4)
      .lean();

    const zones = latest.map((z) => ({
      id: z.gate_id,
      crowdLevel: z.crowdLevel,
      waitTime: z.waitTime,
      hour: z.hour,
      day: z.day,
    }));

    const prediction = await getPrediction(zones);

    io.emit("zoneUpdate", prediction);

    res.json({ success: true });
  } catch (err) {
    console.log("❌ IoT error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================
// 📍 ZONES
// =======================
app.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find().lean();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// ❤️ HEALTH
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "running",
    ai: process.env.AI_URL || "local",
  });
});

// =======================
// 🧠 DB
// =======================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
    });

    console.log("✅ MongoDB connected");
    await seedZones();
  } catch (err) {
    console.error("❌ DB error:", err.message);
    process.exit(1);
  }
}

// =======================
// 🌱 SEED
// =======================
async function seedZones() {
  const zones = [
    { name: "Gate A", lat: 25.4484, lng: 78.5685 },
    { name: "Gate B", lat: 25.4490, lng: 78.5690 },
    { name: "Gate C", lat: 25.4475, lng: 78.5670 },
    { name: "Gate D", lat: 25.4500, lng: 78.5700 },
  ];

  for (const z of zones) {
    await Zone.findOneAndUpdate(
      { name: z.name },
      { ...z, crowdLevel: 0, waitTime: 0 },
      { upsert: true }
    );
  }

  console.log("✅ Zones ready");
}

// =======================
// 🔌 SOCKET
// =======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

// =======================
// 🚀 START
// =======================
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
})();