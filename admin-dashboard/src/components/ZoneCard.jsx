import { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";

// 🔥 SINGLE SOCKET INSTANCE (IMPORTANT FIX)
const socket = io("http://localhost:5000");

export default function ZoneCard({ zone }) {
  const [crowd, setCrowd] = useState(zone.crowdLevel);
  const [wait, setWait] = useState(zone.waitTime);
  const [loading, setLoading] = useState(false);

  // 🔄 SYNC WITH BACKEND (REAL-TIME UPDATE)
  useEffect(() => {
    setCrowd(zone.crowdLevel);
    setWait(zone.waitTime);
  }, [zone]);

  const updateZone = async () => {
    try {
      setLoading(true);

      const payload = {
        name: zone.name,
        crowdLevel: Number(crowd),
        waitTime: Number(wait),
        lat: zone.lat,
        lng: zone.lng,
      };

      // ⚡ REAL-TIME EMIT (PRIMARY)
      socket.emit("updateZone", payload);

      // ⚡ BACKUP API (SAFE)
      await axios.post("http://localhost:5000/zone", payload);

    } catch (err) {
      console.log("Update Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = () => {
    if (crowd > 70) return { text: "High", color: "#ef4444" };
    if (crowd > 40) return { text: "Moderate", color: "#f59e0b" };
    return { text: "Smooth", color: "#22c55e" };
  };

  const status = getStatus();

  return (
    <div style={styles.card}>
      {/* HEADER */}
      <div style={styles.row}>
        <h2 style={{ margin: 0 }}>{zone.name}</h2>
        <span style={{ ...styles.badge, background: status.color }}>
          {status.text}
        </span>
      </div>

      {/* PROGRESS BAR */}
      <div style={styles.progressBg}>
        <div
          style={{
            ...styles.progressFill,
            width: `${crowd}%`,
            background: status.color,
          }}
        />
      </div>

      {/* INFO */}
      <p>👥 Crowd: <strong>{crowd}%</strong></p>
      <p>⏱ Wait: <strong>{wait} min</strong></p>

      {/* SLIDER - CROWD */}
      <label>Crowd Level: {crowd}%</label>
      <input
        type="range"
        min="0"
        max="100"
        value={crowd}
        onChange={(e) => setCrowd(e.target.value)}
        style={styles.slider}
      />

      {/* SLIDER - WAIT */}
      <label>Wait Time: {wait} min</label>
      <input
        type="range"
        min="0"
        max="30"
        value={wait}
        onChange={(e) => setWait(e.target.value)}
        style={styles.slider}
      />

      {/* BUTTON */}
      <button
        style={{
          ...styles.button,
          opacity: loading ? 0.6 : 1,
        }}
        onClick={updateZone}
        disabled={loading}
      >
        {loading ? "Updating..." : "🚀 Update Zone"}
      </button>
    </div>
  );
}

// 🎨 STYLES
const styles = {
  card: {
    background: "#1e293b",
    padding: "20px",
    borderRadius: "14px",
    color: "white",
    boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    transition: "0.3s",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },

  badge: {
    padding: "6px 12px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  progressBg: {
    height: "10px",
    background: "#334155",
    borderRadius: "6px",
    margin: "12px 0",
  },

  progressFill: {
    height: "10px",
    borderRadius: "6px",
    transition: "0.4s",
  },

  slider: {
    width: "100%",
    marginBottom: "10px",
    cursor: "pointer",
  },

  button: {
    marginTop: "10px",
    width: "100%",
    padding: "12px",
    background: "#22c55e",
    border: "none",
    borderRadius: "10px",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },
};