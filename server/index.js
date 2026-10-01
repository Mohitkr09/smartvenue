require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const axios = require("axios");

// =======================
// MODELS
// =======================
const Zone = require("./models/Zone");
const ZoneLog = require("./models/ZoneLog");

// =======================
// ROUTES
// =======================
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

// =======================
// APP
// =======================
const app = express();

// =======================
// MIDDLEWARE
// =======================
app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json({ limit: "2mb" }));

app.use(morgan("dev"));

// =======================
// ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// =======================
// AI FUNCTION
// =======================
const getPrediction = async (zones) => {
  try {
    const AI_URL =
      process.env.AI_URL || "http://127.0.0.1:7000/predict-zones";

    console.log("🤖 Sending zones to AI:", zones.length);

    const response = await axios.post(
      AI_URL,
      {
        zones,
      },
      {
        timeout: 5000,
      }
    );

    console.log("✅ AI prediction received");

    return response.data?.data || zones;
  } catch (err) {
    console.log("⚠️ AI prediction failed:", err.message);

    // Fallback to original zone data
    return zones;
  }
};

// =======================
// RISK CALCULATION
// =======================
const calculateRisk = (crowdLevel, waitTime) => {
  const crowd = Number(crowdLevel) || 0;
  const wait = Number(waitTime) || 0;

  /*
    Crowd contributes 70%
    Waiting time contributes 30%

    Wait time is capped at 50 minutes
    so it doesn't dominate the score.
  */

  const waitScore = Math.min(wait * 2, 100);

  const riskScore = Math.round(
    crowd * 0.7 +
    waitScore * 0.3
  );

  let riskLevel;

  if (riskScore > 70) {
    riskLevel = "High";
  } else if (riskScore > 40) {
    riskLevel = "Medium";
  } else {
    riskLevel = "Low";
  }

  let riskReason;

  if (riskLevel === "High") {
    riskReason = "High crowd density or long waiting time";
  } else if (riskLevel === "Medium") {
    riskReason = "Moderate crowd or waiting time";
  } else {
    riskReason = "Low crowd density and short waiting time";
  }

  return {
    riskScore,
    riskLevel,
    riskReason,
  };
};

// =======================
// CROWD STATUS
// =======================
const calculateStatus = (crowdLevel) => {
  const crowd = Number(crowdLevel) || 0;

  if (crowd > 70) {
    return "High";
  }

  if (crowd > 40) {
    return "Moderate";
  }

  return "Smooth";
};

// =======================
// ROUTE API
// =======================
app.post("/route", async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (
      !origin ||
      origin.lat == null ||
      origin.lng == null ||
      !destination ||
      destination.lat == null ||
      destination.lng == null
    ) {
      return res.status(400).json({
        error: "Invalid origin or destination",
      });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        error: "Google Maps API key is not configured",
      });
    }

    console.log(
      `🧭 Route: ${origin.lat},${origin.lng} → ${destination.lat},${destination.lng}`
    );

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
        timeout: 5000,
      }
    );

    if (response.data.status !== "OK") {
      console.log(
        "⚠️ Google Directions:",
        response.data.status
      );

      return res.status(400).json({
        error: "Route unavailable",
        status: response.data.status,
      });
    }

    res.json(response.data);
  } catch (err) {
    console.log("❌ Route error:", err.message);

    res.status(500).json({
      error: "Route failed",
    });
  }
});

// =======================
// 📡 IOT / YOLO DATA
// =======================
app.post("/iot-data", async (req, res) => {
  try {
    const {
      gate_id,
      crowdLevel,
      waitTime,
      device_id,
    } = req.body;

    // -----------------------
    // VALIDATION
    // -----------------------
    if (!gate_id) {
      return res.status(400).json({
        error: "gate_id required",
      });
    }

    const crowd = Number(crowdLevel);

    const wait = Number(waitTime);

    if (Number.isNaN(crowd)) {
      return res.status(400).json({
        error: "crowdLevel must be a number",
      });
    }

    if (Number.isNaN(wait)) {
      return res.status(400).json({
        error: "waitTime must be a number",
      });
    }

    // Keep values inside valid range
    const safeCrowd = Math.max(
      0,
      Math.min(100, crowd)
    );

    const safeWait = Math.max(
      0,
      wait
    );

    // -----------------------
    // TIME DATA
    // -----------------------
    const now = new Date();

    // -----------------------
    // GATE ID NORMALIZATION
    // -----------------------
    let normalizedGateId = String(gate_id).trim();

    /*
      Supports:

      "A"      → "Gate A"
      "B"      → "Gate B"
      "Gate A" → "Gate A"
    */

    let gateName = normalizedGateId;

    if (
      !normalizedGateId
        .toLowerCase()
        .startsWith("gate ")
    ) {
      gateName = `Gate ${normalizedGateId}`;
    }

    // -----------------------
    // RISK
    // -----------------------
    const risk = calculateRisk(
      safeCrowd,
      safeWait
    );

    // -----------------------
    // STATUS
    // -----------------------
    const status = calculateStatus(
      safeCrowd
    );

    // -----------------------
    // CREATE LOG
    // -----------------------
    const logData = {
      gate_id: normalizedGateId,
      crowdLevel: safeCrowd,
      waitTime: safeWait,
      hour: now.getHours(),
      day: now.getDay(),
      timestamp: now,
    };

    await ZoneLog.create(logData);

    console.log(
      `📡 ${gateName} → Crowd: ${safeCrowd}% | Wait: ${safeWait} min`
    );

    // -----------------------
    // UPDATE CURRENT ZONE
    // -----------------------
    const updatedZone =
      await Zone.findOneAndUpdate(
        {
          name: gateName,
        },
        {
          crowdLevel: safeCrowd,
          waitTime: safeWait,
          status,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          riskReason: risk.riskReason,
        },
        {
          new: true,
        }
      );

    if (!updatedZone) {
      console.log(
        `⚠️ Zone not found: ${gateName}`
      );

      return res.status(404).json({
        error: `Zone ${gateName} not found`,
      });
    }

    // =======================
    // GET LATEST LOG PER GATE
    // =======================

    /*
      Instead of:

      .sort({ timestamp: -1 })
      .limit(4)

      which can return multiple logs
      from the same gate,

      we get the newest record
      for every gate.
    */

    const latestLogs =
      await ZoneLog.aggregate([
        {
          $sort: {
            timestamp: -1,
          },
        },
        {
          $group: {
            _id: "$gate_id",
            latest: {
              $first: "$$ROOT",
            },
          },
        },
        {
          $replaceRoot: {
            newRoot: "$latest",
          },
        },
      ]);

    // =======================
    // PREPARE AI INPUT
    // =======================

    const aiZones = latestLogs.map(
      (zone) => ({
        id: zone.gate_id,

        crowdLevel:
          zone.crowdLevel,

        waitTime:
          zone.waitTime,

        hour:
          zone.hour,

        day:
          zone.day,
      })
    );

    console.log(
      "🤖 AI zones:",
      aiZones
    );

    // =======================
    // AI PREDICTION
    // =======================

    const prediction =
      await getPrediction(aiZones);

    console.log(
      "🧠 Prediction:",
      prediction
    );

    // =======================
    // SAVE AI PREDICTION
    // =======================

    /*
      AI response may be an array like:

      [
        {
          id: "A",
          crowdLevel: 30,
          waitTime: 4,
          prediction: "Low crowd expected"
        }
      ]
    */

    if (Array.isArray(prediction)) {
      for (const p of prediction) {
        if (!p?.id) {
          continue;
        }

        let predictionGate =
          String(p.id).trim();

        let predictionGateName =
          predictionGate;

        if (
          !predictionGate
            .toLowerCase()
            .startsWith("gate ")
        ) {
          predictionGateName =
            `Gate ${predictionGate}`;
        }

        const predictionCrowd =
          Number(
            p.crowdLevel ?? 0
          );

        const predictionWait =
          Number(
            p.waitTime ?? 0
          );

        const predictionRisk =
          calculateRisk(
            predictionCrowd,
            predictionWait
          );

        const predictionStatus =
          calculateStatus(
            predictionCrowd
          );

        await Zone.findOneAndUpdate(
          {
            name: predictionGateName,
          },
          {
            crowdLevel:
              predictionCrowd,

            waitTime:
              predictionWait,

            status:
              predictionStatus,

            prediction:
              p.prediction ||
              "Analyzing...",

            riskScore:
              predictionRisk.riskScore,

            riskLevel:
              predictionRisk.riskLevel,

            riskReason:
              predictionRisk.riskReason,
          },
          {
            new: true,
          }
        );
      }
    }

    // =======================
    // GET FINAL ZONES
    // =======================

    const finalZones =
      await Zone.find()
        .lean();

    // =======================
    // REAL-TIME SOCKET UPDATE
    // =======================

    io.emit(
      "zoneUpdate",
      finalZones
    );

    console.log(
      "📡 zoneUpdate emitted"
    );

    // =======================
    // RESPONSE
    // =======================

    res.json({
      success: true,

      gate: gateName,

      crowdLevel:
        safeCrowd,

      waitTime:
        safeWait,

      status,

      riskScore:
        risk.riskScore,

      riskLevel:
        risk.riskLevel,

      zones:
        finalZones,
    });
  } catch (err) {
    console.error(
      "❌ IoT error:",
      err
    );

    res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
});

// =======================
// 📍 GET ZONES
// =======================
app.get("/zones", async (req, res) => {
  try {
    const zones =
      await Zone.find()
        .sort({
          name: 1,
        })
        .lean();

    res.json(zones);
  } catch (err) {
    console.error(
      "❌ Zones error:",
      err.message
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// =======================
// 📍 GET SINGLE ZONE
// =======================
app.get(
  "/zones/:name",
  async (req, res) => {
    try {
      const zone =
        await Zone.findOne({
          name: req.params.name,
        }).lean();

      if (!zone) {
        return res.status(404).json({
          error: "Zone not found",
        });
      }

      res.json(zone);
    } catch (err) {
      console.error(
        "❌ Single zone error:",
        err.message
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// =======================
// ❤️ HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "running",

    service: "SmartVenue Backend",

    ai:
      process.env.AI_URL ||
      "local",

    mongodb:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// =======================
// 🧠 DATABASE
// =======================
async function connectDB() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing in .env"
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI,
      {
        autoIndex: true,
      }
    );

    console.log(
      "✅ MongoDB connected"
    );

    await seedZones();
  } catch (err) {
    console.error(
      "❌ DB error:",
      err.message
    );

    process.exit(1);
  }
}

// =======================
// 🌱 SEED ZONES
// =======================
async function seedZones() {
  const zones = [
    {
      name: "Gate A",
      lat: 25.4484,
      lng: 78.5685,
    },

    {
      name: "Gate B",
      lat: 25.4490,
      lng: 78.5690,
    },

    {
      name: "Gate C",
      lat: 25.4475,
      lng: 78.5670,
    },

    {
      name: "Gate D",
      lat: 25.4500,
      lng: 78.5700,
    },
  ];

  for (const zone of zones) {
    const existing =
      await Zone.findOne({
        name: zone.name,
      });

    if (!existing) {
      const risk =
        calculateRisk(0, 0);

      await Zone.create({
        ...zone,

        crowdLevel: 0,

        waitTime: 0,

        prediction:
          "Analyzing...",

        status: "Smooth",

        riskScore:
          risk.riskScore,

        riskLevel:
          risk.riskLevel,

        riskReason:
          risk.riskReason,
      });

      console.log(
        `🌱 Created ${zone.name}`
      );
    } else {
      /*
        Don't reset crowdLevel every
        time the server restarts.
      */

      await Zone.updateOne(
        {
          _id: existing._id,
        },
        {
          lat: zone.lat,
          lng: zone.lng,
        }
      );
    }
  }

  console.log(
    "✅ Zones ready"
  );
}

// =======================
// 🔌 HTTP SERVER
// =======================
const server =
  http.createServer(app);

// =======================
// 🔌 SOCKET.IO
// =======================
const io =
  new Server(server, {
    cors: {
      origin: "*",
      methods: [
        "GET",
        "POST",
      ],
    },
  });

// =======================
// SOCKET CONNECTION
// =======================
io.on(
  "connection",
  (socket) => {
    console.log(
      "🟢 Socket connected:",
      socket.id
    );

    // Send current zones immediately
    Zone.find()
      .lean()
      .then((zones) => {
        socket.emit(
          "zoneUpdate",
          zones
        );
      })
      .catch((err) => {
        console.log(
          "⚠️ Socket initial data error:",
          err.message
        );
      });

    socket.on(
      "disconnect",
      () => {
        console.log(
          "🔴 Socket disconnected:",
          socket.id
        );
      }
    );
  }
);

// =======================
// 🚀 START SERVER
// =======================
const PORT =
  process.env.PORT || 5000;

(async () => {
  await connectDB();

  server.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        "========================================"
      );

      console.log(
        `🚀 SmartVenue server running on port ${PORT}`
      );

      console.log(
        `🌐 http://localhost:${PORT}`
      );

      console.log(
        `📍 Zones: http://localhost:${PORT}/zones`
      );

      console.log(
        `❤️ Health: http://localhost:${PORT}/`
      );

      console.log(
        "========================================"
      );
    }
  );
})();