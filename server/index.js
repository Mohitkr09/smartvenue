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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: false,
  })
);

app.use(express.json({ limit: "2mb" }));

app.use(morgan("dev"));

// =======================
// ROUTES
// =======================

app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// ============================================================
// HELPER: CLAMP NUMBER
// ============================================================

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, number));
}

// ============================================================
// AI FUNCTION
// ============================================================

const getPrediction = async (zones) => {
  try {
    if (!Array.isArray(zones) || zones.length === 0) {
      console.log("⚠️ No zones provided to AI");
      return [];
    }

    // AI_URL should contain only the base URL.
    //
    // Example:
    // https://smartvenue-u3vr.onrender.com
    //
    // We add /predict-zones here.

    const aiBaseUrl = (
      process.env.AI_URL || "http://127.0.0.1:7000"
    ).replace(/\/+$/, "");

    const aiEndpoint = `${aiBaseUrl}/predict-zones`;

    console.log("========================================");
    console.log("🤖 AI REQUEST");
    console.log("🌐 AI Endpoint:", aiEndpoint);
    console.log("📦 Zones:", zones.length);
    console.log("========================================");

    const response = await axios.post(
      aiEndpoint,
      {
        zones,
      },
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log("✅ AI HTTP Status:", response.status);
    console.log("🤖 AI Response:", response.data);

    // Expected AI response:
    //
    // {
    //   success: true,
    //   data: [...]
    // }

    if (
      response.data &&
      response.data.success === true &&
      Array.isArray(response.data.data)
    ) {
      return response.data.data;
    }

    // Some versions may return data directly.
    if (Array.isArray(response.data?.data)) {
      return response.data.data;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    console.log("⚠️ Unexpected AI response format");

    return [];
  } catch (err) {
    console.error("========================================");
    console.error("❌ AI PREDICTION FAILED");
    console.error("Status:", err.response?.status);
    console.error("Response:", err.response?.data);
    console.error("Message:", err.message);
    console.error("========================================");

    return [];
  }
};

// ============================================================
// RISK CALCULATION
// ============================================================

const calculateRisk = (crowdLevel, waitTime) => {
  const crowd = clamp(crowdLevel, 0, 100);

  const wait = Math.max(0, Number(waitTime) || 0);

  /*
    Crowd contributes 70%
    Waiting time contributes 30%

    Wait time is converted to a score
    and capped at 100.
  */

  const waitScore = Math.min(wait * 2, 100);

  const riskScore = Math.round(
    crowd * 0.7 +
      waitScore * 0.3
  );

  let riskLevel;
  let riskReason;

  if (riskScore > 70) {
    riskLevel = "High";
    riskReason = "High crowd density or long waiting time";
  } else if (riskScore > 40) {
    riskLevel = "Medium";
    riskReason = "Moderate crowd or waiting time";
  } else {
    riskLevel = "Low";
    riskReason = "Low crowd density and short waiting time";
  }

  return {
    riskScore,
    riskLevel,
    riskReason,
  };
};

// ============================================================
// CROWD STATUS
// ============================================================

const calculateStatus = (crowdLevel) => {
  const crowd = clamp(crowdLevel, 0, 100);

  if (crowd > 70) {
    return "High";
  }

  if (crowd > 40) {
    return "Moderate";
  }

  return "Smooth";
};

// ============================================================
// AI STATUS NORMALIZATION
// ============================================================

const normalizeAIStatus = (status) => {
  if (!status) {
    return "LOW";
  }

  const value = String(status)
    .trim()
    .toUpperCase();

  if (value === "HIGH") {
    return "HIGH";
  }

  if (value === "MEDIUM" || value === "MODERATE") {
    return "MEDIUM";
  }

  return "LOW";
};

// ============================================================
// GATE NAME NORMALIZATION
// ============================================================

function normalizeGateName(gateId) {
  if (gateId === undefined || gateId === null) {
    return null;
  }

  const value = String(gateId).trim();

  if (!value) {
    return null;
  }

  // Already "Gate A"
  if (/^Gate\s+[A-D]$/i.test(value)) {
    return `Gate ${value.slice(-1).toUpperCase()}`;
  }

  // "Gate_A"
  if (/^Gate\_[A-D]$/i.test(value)) {
    return `Gate ${value.slice(-1).toUpperCase()}`;
  }

  // "A"
  if (/^[A-D]$/i.test(value)) {
    return `Gate ${value.toUpperCase()}`;
  }

  // VIP Gate or another existing name
  return value;
}

// ============================================================
// BUILD AI PREDICTION TEXT
// ============================================================

const buildPredictionText = ({
  futureCrowd,
  isBest,
  suggestion,
}) => {
  let predictionText = `Future crowd: ${futureCrowd}%`;

  if (isBest === true) {
    predictionText += " | Recommended gate";
  }

  if (suggestion) {
    predictionText += ` | ${suggestion}`;
  }

  return predictionText;
};

// ============================================================
// ROUTE API
// ============================================================

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
        timeout: 10000,
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
        message: response.data.error_message || null,
      });
    }

    return res.json(response.data);
  } catch (err) {
    console.error("❌ Route error:", err.message);

    return res.status(500).json({
      error: "Route failed",
      message: err.message,
    });
  }
});

// ============================================================
// 📡 IOT / YOLO DATA
// ============================================================

app.post("/iot-data", async (req, res) => {
  try {
    const {
      gate_id,
      crowdLevel,
      waitTime,
      device_id,
      timestamp,
    } = req.body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!gate_id) {
      return res.status(400).json({
        success: false,
        error: "gate_id required",
      });
    }

    const crowd = Number(crowdLevel);
    const wait = Number(waitTime);

    if (!Number.isFinite(crowd)) {
      return res.status(400).json({
        success: false,
        error: "crowdLevel must be a number",
      });
    }

    if (!Number.isFinite(wait)) {
      return res.status(400).json({
        success: false,
        error: "waitTime must be a number",
      });
    }

    // ========================================================
    // SAFE VALUES
    // ========================================================

    const safeCrowd = clamp(crowd, 0, 100);

    const safeWait = Math.max(0, wait);

    // ========================================================
    // TIME DATA
    // ========================================================

    const now = timestamp
      ? new Date(
          Number(timestamp) < 100000000000
            ? Number(timestamp) * 1000
            : Number(timestamp)
        )
      : new Date();

    const validTimestamp = Number.isNaN(now.getTime())
      ? new Date()
      : now;

    const currentHour = validTimestamp.getHours();
    const currentDay = validTimestamp.getDay();

    // ========================================================
    // GATE ID
    // ========================================================

    const normalizedGateId = String(gate_id).trim();

    const gateName = normalizeGateName(
      normalizedGateId
    );

    if (!gateName) {
      return res.status(400).json({
        success: false,
        error: "Invalid gate_id",
      });
    }

    // ========================================================
    // RISK
    // ========================================================

    const risk = calculateRisk(
      safeCrowd,
      safeWait
    );

    // ========================================================
    // STATUS
    // ========================================================

    const status = calculateStatus(
      safeCrowd
    );

    // ========================================================
    // CREATE ZONE LOG
    // ========================================================

    const logData = {
      gate_id: normalizedGateId,
      crowdLevel: safeCrowd,
      waitTime: safeWait,
      hour: currentHour,
      day: currentDay,
      timestamp: validTimestamp,
    };

    await ZoneLog.create(logData);

    console.log(
      `📡 ${gateName} → Crowd: ${safeCrowd}% | Wait: ${safeWait} min | Device: ${
        device_id || "unknown"
      }`
    );

    // ========================================================
    // UPDATE CURRENT ZONE
    // ========================================================

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
          returnDocument: "after",
        }
      );

    if (!updatedZone) {
      console.log(
        `⚠️ Zone not found: ${gateName}`
      );

      return res.status(404).json({
        success: false,
        error: `Zone ${gateName} not found`,
      });
    }

    // ========================================================
    // GET LATEST LOG PER GATE
    // ========================================================

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

    // ========================================================
    // PREPARE AI INPUT
    // ========================================================

    /*
      Use the current request time for every gate.

      This avoids having:

      Gate A → hour 12
      Gate B → hour 0
      Gate C → hour 0
      Gate D → hour 0

      in the same AI request.
    */

    const aiZones = latestLogs.map((zone) => ({
      id: normalizeGateName(zone.gate_id),
      crowdLevel: Number(zone.crowdLevel || 0),
      waitTime: Number(zone.waitTime || 0),
      hour: currentHour,
      day: currentDay,
    }));

    console.log("========================================");
    console.log("🤖 AI ZONES:");
    console.log(aiZones);
    console.log("========================================");

    // ========================================================
    // AI PREDICTION
    // ========================================================

    const prediction = await getPrediction(
      aiZones
    );

    console.log("🧠 AI Prediction:", prediction);

    // ========================================================
    // SAVE AI PREDICTION
    // ========================================================

    if (
      Array.isArray(prediction) &&
      prediction.length > 0
    ) {
      console.log(
        `🧠 Saving ${prediction.length} AI predictions`
      );

      for (const p of prediction) {
        if (!p || !p.id) {
          continue;
        }

        // ====================================================
        // NORMALIZE GATE NAME
        // ====================================================

        const predictionGateName =
          normalizeGateName(p.id);

        if (!predictionGateName) {
          continue;
        }

        // ====================================================
        // AI VALUES
        // ====================================================

        const futureCrowd = clamp(
          p.futureCrowd ??
            p.crowdLevel ??
            0,
          0,
          100
        );

        const currentCrowd = clamp(
          p.crowdLevel ??
            0,
          0,
          100
        );

        const predictionWait = Math.max(
          0,
          Number(p.waitTime ?? 0)
        );

        // AI score
        const aiScore = clamp(
          p.score ?? 0,
          0,
          100
        );

        // AI status
        const aiStatus =
          normalizeAIStatus(p.status);

        // AI suggestion
        const aiSuggestion =
          p.suggestion
            ? String(p.suggestion)
            : "";

        // AI best gate
        const aiIsBest =
          p.isBest === true;

        // ====================================================
        // CURRENT RISK
        // ====================================================

        const predictionRisk =
          calculateRisk(
            currentCrowd,
            predictionWait
          );

        // ====================================================
        // CURRENT CROWD STATUS
        // ====================================================

        const predictionStatus =
          calculateStatus(
            currentCrowd
          );

        // ====================================================
        // READABLE PREDICTION
        // ====================================================

        const predictionText =
          buildPredictionText({
            futureCrowd,
            isBest: aiIsBest,
            suggestion: aiSuggestion,
          });

        // ====================================================
        // UPDATE ZONE WITH STRUCTURED AI DATA
        // ====================================================

        const updatedPrediction =
          await Zone.findOneAndUpdate(
            {
              name: predictionGateName,
            },
            {
              // --------------------------------------------
              // Human-readable prediction
              // --------------------------------------------

              prediction:
                predictionText,

              // --------------------------------------------
              // AI STRUCTURED DATA
              // --------------------------------------------

              futureCrowd,

              aiScore,

              aiStatus,

              aiSuggestion,

              aiIsBest,

              // --------------------------------------------
              // IMPORTANT:
              // Keep current crowd separate from future crowd.
              // --------------------------------------------

              // Current crowd remains the existing
              // MongoDB crowdLevel.

              // --------------------------------------------
              // Current status/risk
              // --------------------------------------------

              status:
                predictionStatus,

              riskScore:
                predictionRisk.riskScore,

              riskLevel:
                predictionRisk.riskLevel,

              riskReason:
                predictionRisk.riskReason,
            },
            {
              returnDocument: "after",
            }
          );

        // ====================================================
        // LOG RESULT
        // ====================================================

        if (updatedPrediction) {
          console.log(
            `✅ ${predictionGateName} → ` +
            `Current Crowd: ${currentCrowd}% | ` +
            `Future Crowd: ${futureCrowd}% | ` +
            `AI Score: ${aiScore} | ` +
            `AI Status: ${aiStatus} | ` +
            `Best: ${aiIsBest}`
          );
        } else {
          console.log(
            `⚠️ AI gate not found in MongoDB: ${predictionGateName}`
          );
        }
      }
    } else {
      console.log(
        "⚠️ No AI predictions received. Keeping existing zone data."
      );
    }

    // ========================================================
    // GET FINAL ZONES
    // ========================================================

    const finalZones =
      await Zone.find()
        .sort({
          name: 1,
        })
        .lean();

    // ========================================================
    // REAL-TIME SOCKET UPDATE
    // ========================================================

    io.emit(
      "zoneUpdate",
      finalZones
    );

    console.log(
      "📡 zoneUpdate emitted"
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.json({
      success: true,

      gate: gateName,

      crowdLevel: safeCrowd,

      waitTime: safeWait,

      status,

      riskScore: risk.riskScore,

      riskLevel: risk.riskLevel,

      aiPredictionCount:
        Array.isArray(prediction)
          ? prediction.length
          : 0,

      zones: finalZones,
    });
  } catch (err) {
    console.error(
      "❌ IoT error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
});

// ============================================================
// 📍 GET ALL ZONES
// ============================================================

app.get("/zones", async (req, res) => {
  try {
    const zones =
      await Zone.find()
        .sort({
          name: 1,
        })
        .lean();

    return res.json(zones);
  } catch (err) {
    console.error(
      "❌ Zones error:",
      err.message
    );

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ============================================================
// 📍 GET SINGLE ZONE
// ============================================================

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
          success: false,
          error: "Zone not found",
        });
      }

      return res.json(zone);
    } catch (err) {
      console.error(
        "❌ Single zone error:",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// ============================================================
// ❤️ HEALTH CHECK
// ============================================================

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

// ============================================================
// 🧠 DATABASE
// ============================================================

async function connectDB() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing in environment variables"
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

// ============================================================
// 🌱 SEED ZONES
// ============================================================

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

        // --------------------------------------------
        // AI
        // --------------------------------------------

        prediction: "Analyzing...",

        futureCrowd: 0,

        aiScore: 0,

        aiStatus: "LOW",

        aiSuggestion: "",

        aiIsBest: false,

        // --------------------------------------------
        // Current status
        // --------------------------------------------

        status: "Smooth",

        // --------------------------------------------
        // Risk
        // --------------------------------------------

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
        Do not reset:

        crowdLevel
        waitTime
        prediction
        futureCrowd
        aiScore
        aiStatus
        aiSuggestion
        aiIsBest
        risk information

        Only ensure coordinates remain correct.
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

// ============================================================
// 🔌 HTTP SERVER
// ============================================================

const server =
  http.createServer(app);

// ============================================================
// 🔌 SOCKET.IO
// ============================================================

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

// ============================================================
// SOCKET CONNECTION
// ============================================================

io.on(
  "connection",
  (socket) => {
    console.log(
      "🟢 Socket connected:",
      socket.id
    );

    // --------------------------------------------------------
    // Send current zones immediately
    // --------------------------------------------------------

    Zone.find()
      .sort({
        name: 1,
      })
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

    // --------------------------------------------------------
    // Disconnect
    // --------------------------------------------------------

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

// ============================================================
// 🚀 START SERVER
// ============================================================

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
        "🌐 Server started successfully"
      );

      console.log(
        "📍 Zones endpoint: /zones"
      );

      console.log(
        "❤️ Health endpoint: /"
      );

      console.log(
        `🤖 AI URL: ${
          process.env.AI_URL || "local"
        }`
      );

      console.log(
        "========================================"
      );
    }
  );
})();