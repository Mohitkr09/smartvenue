import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  SafeAreaView,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SOCKET_URL = "https://smartvenue.online";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const socketRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    if (socketRef.current) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("zoneUpdate", (zone) => {
      if (!zone) return;

      const name = zone.name || `Gate ${zone.id || ""}`;
      const crowd = zone.crowdLevel ?? 0;

      let message = null;
      let type = null;

      if (crowd > 80) {
        message = `${name} is overcrowded`;
        type = "danger";
      } else if (crowd < 30) {
        message = `${name} is now free`;
        type = "safe";
      }

      if (!message) return;

      const newAlert = {
        id: Date.now(),
        message,
        type,
        time: new Date().toLocaleTimeString(),
      };

      setAlerts((prev) => [newAlert, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        
        {/* ✅ FIXED HEADER */}
        <View style={{ paddingTop: insets.top + 5 }}>
          <Text style={styles.header}>🔔 Live Alerts</Text>
        </View>

        {/* ✅ EMPTY STATE CENTERED */}
        {alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No alerts yet</Text>
              <Text style={styles.emptySub}>
                You’ll see live updates here
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 100,
            }}
            renderItem={({ item }) => {
              const isDanger = item.type === "danger";

              return (
                <View style={styles.card}>
                  <Text style={styles.message}>
                    {isDanger ? "🚨" : "✅"} {item.message}
                  </Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
              );
            }}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  container: {
    flex: 1,
    paddingHorizontal: 15,
  },

  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 10,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyCard: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 16,
    alignItems: "center",
    width: "80%",
    elevation: 5,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },

  emptySub: {
    color: "#64748b",
    marginTop: 6,
  },

  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 14,
    marginVertical: 6,
    elevation: 3,
  },

  message: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },

  time: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 5,
  },
});