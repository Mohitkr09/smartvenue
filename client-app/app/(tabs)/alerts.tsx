import { View, Text, FlatList, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// ✅ USE YOUR DOMAIN (IMPORTANT)
const SOCKET_URL = "https://smartvenue.online";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    console.log("🚀 Connecting socket...");

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    setSocket(newSocket);

    // ==============================
    // ✅ CONNECTION EVENTS
    // ==============================

    newSocket.on("connect", () => {
      console.log("🟢 Connected:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("🔴 Disconnected:", reason);
    });

    newSocket.on("connect_error", (err) => {
      console.log("❌ Socket Error:", err.message);
    });

    // ==============================
    // 📡 REAL-TIME ALERTS (FIXED EVENT)
    // ==============================

    newSocket.on("zoneUpdate", (zone) => {
      try {
        if (!zone) return;

        // 🚨 High crowd
        if (zone.crowdLevel > 80) {
          const newAlert = {
            id: Date.now(),
            message: `🚨 ${zone.name || "Zone"} is overcrowded!`,
            time: new Date().toLocaleTimeString(),
          };

          setAlerts((prev) => [newAlert, ...prev]);
        }

        // ✅ Low crowd
        if (zone.crowdLevel < 30) {
          const newAlert = {
            id: Date.now(),
            message: `✅ ${zone.name || "Zone"} is now free`,
            time: new Date().toLocaleTimeString(),
          };

          setAlerts((prev) => [newAlert, ...prev]);
        }
      } catch (err) {
        console.log("❌ Alert error:", err.message);
      }
    });

    // ==============================
    // 🔌 CLEANUP (VERY IMPORTANT)
    // ==============================

    return () => {
      console.log("🔌 Cleaning socket...");
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🔔 Alerts</Text>

      {alerts.length === 0 && (
        <Text style={styles.empty}>No alerts yet</Text>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
        )}
      />
    </View>
  );
}

// 🎨 STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingTop: 30,
  },
  header: {
    color: "white",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  empty: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 20,
  },
  card: {
    backgroundColor: "#1e293b",
    margin: 10,
    padding: 15,
    borderRadius: 12,
  },
  message: {
    color: "white",
    fontSize: 16,
  },
  time: {
    color: "#94a3b8",
    marginTop: 5,
    fontSize: 12,
  },
});