import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function Dashboard() {
  const [zones, setZones] = useState([]);
  const [alert, setAlert] = useState(null);

  const [newGate, setNewGate] = useState({
    name: "",
    crowdLevel: 0,
    waitTime: 0,
    lat: "",
    lng: "",
  });

  // 📊 Analytics
  const totalGates = zones.length;

  const avgCrowd =
    zones.reduce((sum, z) => sum + (z.crowdLevel || 0), 0) /
    (zones.length || 1);

  const highCrowd = zones.filter(
    (z) => z.futureCrowd >= 80
  ).length;

  // 🔄 Fetch initial data
  const fetchZones = async () => {
    const res = await axios.get("http://localhost:5000/zones");
    setZones(res.data);
  };

  useEffect(() => {
    fetchZones();

    socket.on("zoneUpdated", (updatedZone) => {
      setZones((prev) => {
        const exists = prev.find((z) => z.name === updatedZone.name);

        // 🚨 ALERT based on FUTURE prediction
        if (updatedZone.futureCrowd >= 85) {
          setAlert(
            `🚨 ${updatedZone.name} will be overcrowded soon!`
          );
          setTimeout(() => setAlert(null), 4000);
        }

        return exists
          ? prev.map((z) =>
              z.name === updatedZone.name ? updatedZone : z
            )
          : [...prev, updatedZone];
      });
    });

    const interval = setInterval(fetchZones, 10000);

    return () => {
      socket.off("zoneUpdated");
      clearInterval(interval);
    };
  }, []);

  // ➕ Add Gate
  const addGate = async () => {
    try {
      const payload = {
        ...newGate,
        crowdLevel: Number(newGate.crowdLevel),
        waitTime: Number(newGate.waitTime),
        lat: Number(newGate.lat),
        lng: Number(newGate.lng),
      };

      socket.emit("updateZone", payload);
      await axios.post("http://localhost:5000/zone", payload);

      setNewGate({
        name: "",
        crowdLevel: 0,
        waitTime: 0,
        lat: "",
        lng: "",
      });
    } catch (err) {
      console.log(err);
    }
  };

  // 🎨 Status Colors
  const getColor = (status) => {
    switch (status) {
      case "OVERCROWDED":
        return "#ef4444";
      case "HIGH":
        return "#f97316";
      case "INCREASING":
        return "#eab308";
      case "MODERATE":
        return "#3b82f6";
      case "SMOOTH":
        return "#22c55e";
      default:
        return "#64748b";
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🚀 Smart Venue Admin</h1>

      {/* 🚨 ALERT */}
      {alert && <div style={styles.alert}>{alert}</div>}

      {/* 📊 Analytics */}
      <div style={styles.analytics}>
        <div style={styles.card}>
          <h3>Total Gates</h3>
          <p>{totalGates}</p>
        </div>

        <div style={styles.card}>
          <h3>Avg Crowd</h3>
          <p>{avgCrowd.toFixed(1)}%</p>
        </div>

        <div style={styles.card}>
          <h3>Future High Risk</h3>
          <p>{highCrowd}</p>
        </div>
      </div>

      {/* ➕ Add Gate */}
      <div style={styles.form}>
        <h3>➕ Add New Gate</h3>

        <div style={styles.formGrid}>
          <input
            placeholder="Gate Name"
            value={newGate.name}
            onChange={(e) =>
              setNewGate({ ...newGate, name: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Crowd %"
            value={newGate.crowdLevel}
            onChange={(e) =>
              setNewGate({
                ...newGate,
                crowdLevel: e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Wait Time"
            value={newGate.waitTime}
            onChange={(e) =>
              setNewGate({
                ...newGate,
                waitTime: e.target.value,
              })
            }
          />

          <input
            placeholder="Latitude"
            value={newGate.lat}
            onChange={(e) =>
              setNewGate({ ...newGate, lat: e.target.value })
            }
          />

          <input
            placeholder="Longitude"
            value={newGate.lng}
            onChange={(e) =>
              setNewGate({ ...newGate, lng: e.target.value })
            }
          />
        </div>

        <button style={styles.addBtn} onClick={addGate}>
          Add Gate
        </button>
      </div>

      {/* 📍 Zones */}
      <div style={styles.grid}>
        {zones.map((zone) => (
          <div
            key={zone._id}
            style={{
              ...styles.zoneCard,
              borderLeft: `6px solid ${getColor(zone.status)}`
            }}
          >
            <h3>{zone.name}</h3>

            <p>👥 Crowd: {zone.crowdLevel}%</p>
            <p>⏱ Wait: {zone.waitTime} min</p>

            {/* 🔮 Future Prediction */}
            <p style={{ color: "#38bdf8", fontWeight: "bold" }}>
              🔮 Future: {zone.futureCrowd || zone.crowdLevel}%
            </p>

            {/* 🧠 AI Output */}
            <p style={{ color: getColor(zone.status), fontWeight: "bold" }}>
              {zone.message}
            </p>

            {/* 🧭 Route Suggestion */}
            {zone.suggestion && (
              <p style={{ color: "#22c55e" }}>
                🧭 {zone.suggestion}
              </p>
            )}

            {/* 💡 Advice */}
            <p style={{ fontSize: "12px", opacity: 0.8 }}>
              💡 {zone.advice}
            </p>

            {/* 🚨 Alert */}
            {zone.alert && (
              <p style={{ color: "#ef4444", fontWeight: "bold" }}>
                {zone.alert}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 🎨 Styles (unchanged)
const styles = {
  container: {
    padding: "20px",
    background: "#020617",
    minHeight: "100vh",
  },

  title: {
    color: "white",
    marginBottom: "20px",
  },

  alert: {
    background: "#ef4444",
    color: "white",
    padding: "10px",
    borderRadius: "8px",
    marginBottom: "15px",
    textAlign: "center",
  },

  analytics: {
    display: "flex",
    gap: "15px",
    marginBottom: "20px",
  },

  card: {
    flex: 1,
    background: "#1e293b",
    padding: "15px",
    borderRadius: "12px",
    color: "white",
    textAlign: "center",
  },

  form: {
    background: "#1e293b",
    padding: "20px",
    borderRadius: "12px",
    marginBottom: "20px",
    color: "white",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginBottom: "10px",
  },

  addBtn: {
    width: "100%",
    padding: "12px",
    background: "#22c55e",
    border: "none",
    borderRadius: "8px",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "20px",
  },

  zoneCard: {
    background: "#1e293b",
    padding: "15px",
    borderRadius: "12px",
    color: "white",
  },
};