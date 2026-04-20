import { useEffect, useState } from "react";
import axios from "axios";

export default function Analytics() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await axios.get("http://localhost:5000/zones");
    setZones(res.data);
  };

  return (
    <div style={{ padding: "20px", color: "white" }}>
      <h2>📊 Crowd Analytics</h2>

      {zones.map((z) => (
        <div key={z._id} style={{ marginBottom: "10px" }}>
          <strong>{z.name}</strong>
          <div
            style={{
              height: "10px",
              background: "#334155",
              borderRadius: "5px",
            }}
          >
            <div
              style={{
                width: `${z.crowdLevel}%`,
                background:
                  z.crowdLevel > 70
                    ? "#ef4444"
                    : z.crowdLevel > 40
                    ? "#f59e0b"
                    : "#22c55e",
                height: "10px",
                borderRadius: "5px",
              }}
            />
          </div>
          <p>{z.crowdLevel}% crowd</p>
        </div>
      ))}
    </div>
  );
}