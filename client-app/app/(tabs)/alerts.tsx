import { View, Text, FlatList, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://172.20.39.19:5000");

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    socket.on("zoneUpdated", (zone) => {
      if (zone.crowdLevel > 80) {
        const newAlert = {
          id: Date.now(),
          message: `🚨 ${zone.name} is overcrowded!`,
          time: new Date().toLocaleTimeString(),
        };

        setAlerts((prev) => [newAlert, ...prev]);
      }

      if (zone.crowdLevel < 30) {
        const newAlert = {
          id: Date.now(),
          message: `✅ ${zone.name} is now free`,
          time: new Date().toLocaleTimeString(),
        };

        setAlerts((prev) => [newAlert, ...prev]);
      }
    });

    return () => socket.off("zoneUpdated");
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