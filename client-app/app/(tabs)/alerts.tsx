import { View, Text, FlatList, StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// ==============================
// 🌐 CONFIG
// ==============================
const SOCKET_URL = "https://smartvenue.online";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    console.log("🚀 Initializing socket...");

    try {
      // ✅ Prevent multiple connections
      if (socketRef.current) return;

      const socket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        timeout: 10000,
        forceNew: true,
      });

      socketRef.current = socket;

      // ==============================
      // ✅ CONNECTION EVENTS
      // ==============================

      socket.on("connect", () => {
        console.log("🟢 Connected:", socket.id);
      });

      socket.on("disconnect", (reason) => {
        console.log("🔴 Disconnected:", reason);
      });

      socket.on("connect_error", (err) => {
        console.log("❌ Socket Error:", err.message);
      });

      // ==============================
      // 📡 REAL-TIME ALERTS
      // ==============================

      socket.on("zoneUpdate", (zone) => {
        try {
          if (!zone || typeof zone !== "object") return;

          const name = zone.name || "Zone";
          const crowd = zone.crowdLevel ?? 0;

          let message = null;

          if (crowd > 80) {
            message = `🚨 ${name} is overcrowded!`;
          } else if (crowd < 30) {
            message = `✅ ${name} is now free`;
          }

          if (!message) return;

          const newAlert = {
            id: Date.now(),
            message,
            time: new Date().toLocaleTimeString(),
          };

          // ✅ prevent duplicate spam
          setAlerts((prev) => {
            if (prev.length && prev[0].message === message) return prev;
            return [newAlert, ...prev];
          });

        } catch (err) {
          console.log("❌ Alert processing error:", err.message);
        }
      });

    } catch (err) {
      console.log("❌ Socket init crash:", err.message);
    }

    // ==============================
    // 🔌 CLEANUP
    // ==============================
    return () => {
      console.log("🔌 Cleaning socket...");

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
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

// ==============================
// 🎨 STYLES
// ==============================
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