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
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

// =======================
// 🔄 ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// =======================
// 🤖 AI CALL FUNCTION
// =======================
const getPrediction = async (zones) => {
  try {
    const res = await axios.post("http://localhost:7000/predict-zones", {
      zones,
    });

    return res.data.data;

  } catch (err) {
    console.log("⚠️ AI fallback:", err.message);
    return zones; // fallback
  }
};

// =======================
// 📡 IoT DATA (AI ENABLED)
// =======================
app.post("/iot-data", async (req, res) => {
  try {
    const data = req.body;

    if (!data) {
      return res.status(400).json({ error: "No data" });
    }

    console.log("📡 IoT Data:", data);

    const now = new Date();

    const enriched = {
      device_id: data.device_id || "unknown",
      gate_id: data.gate_id,
      crowdLevel: Number(data.crowdLevel || 0),
      waitTime: Number(data.waitTime || 1),
      hour: now.getHours(),
      day: now.getDay(),
      timestamp: now,
    };

    // 💾 SAVE TO MONGO
    await ZoneLog.create(enriched);

    console.log("💾 Saved to Mongo:", enriched.gate_id);

    // 🔥 Update zone live
    await Zone.findOneAndUpdate(
      { name: `Gate ${enriched.gate_id}` },
      {
        crowdLevel: enriched.crowdLevel,
        waitTime: enriched.waitTime,
      }
    );

    // =========================
    // 🧠 FETCH LATEST ZONES
    // =========================
    const latest = await ZoneLog.find()
      .sort({ timestamp: -1 })
      .limit(4);

    const zones = latest.map(z => ({
      id: z.gate_id,
      crowdLevel: z.crowdLevel,
      waitTime: z.waitTime,
      hour: z.hour,
      day: z.day
    }));

    // =========================
    // 🤖 CALL AI
    // =========================
    const prediction = await getPrediction(zones);

    console.log("🤖 AI Prediction:", prediction);

    // =========================
    // 📡 SEND TO APP
    // =========================
    io.emit("zoneUpdate", prediction);

    res.json({ success: true });

  } catch (err) {
    console.log("❌ IoT Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 🌐 HEALTH
// =======================
app.get("/", (req, res) => {
  res.json({ status: "running ✅" });
});

// =======================
// 🔄 ZONES API
// =======================
app.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    console.error("❌ Mongo Error:", err.message);
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

  for (let z of zones) {
    await Zone.findOneAndUpdate(
      { name: z.name },
      {
        ...z,
        crowdLevel: 0,
        waitTime: 0,
      },
      { upsert: true }
    );
  }

  console.log("✅ Zones Seeded");
}

// =======================
// 🔌 SOCKET
// =======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
});

// =======================
// 🚀 START SERVER
// =======================
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Running on ${PORT}`);
  });
}

startServer();