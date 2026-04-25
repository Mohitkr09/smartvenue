import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import axios from "axios";

// ==============================
// 🌐 CONFIG
// ==============================
const SOCKET_URL = "https://smartvenue.online";
const API_URL = "https://smartvenue.online";

// ==============================
// 🔔 NOTIFICATION HANDLER
// ==============================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const socketRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ==============================
  // 🔔 REGISTER PUSH (FIXED)
  // ==============================
  const registerForPush = async () => {
    try {
      if (!Device.isDevice) {
        console.log("❌ Must use real device");
        return;
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } =
          await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("❌ Permission denied");
        return;
      }

      // 🔥 FIX: projectId added
      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId:
            Constants?.expoConfig?.extra?.eas?.projectId,
        })
      ).data;

      console.log("📱 Push Token:", token);

      // ✅ SEND TO BACKEND
      await axios.post(`${API_URL}/save-token`, {
        token,
      });

    } catch (err: any) {
      console.log("❌ Push error:", err.message);
    }
  };

  // ==============================
  // 🔔 LOCAL NOTIFICATION
  // ==============================
  const sendLocalNotification = async (message: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚨 Smart Venue",
          body: message,
          sound: "default",
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (err) {
      console.log("❌ Notification error");
    }
  };

  // ==============================
  // 🚀 INIT
  // ==============================
  useEffect(() => {
    registerForPush();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    console.log("🚀 Initializing socket...");

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
    socket.on("zoneUpdate", async (zone) => {
      try {
        if (!zone) return;

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

        setAlerts((prev) => {
          if (prev.length && prev[0].message === message) return prev;
          return [newAlert, ...prev];
        });

        // 🔥 SHOW PUSH
        await sendLocalNotification(message);

      } catch (err: any) {
        console.log("❌ Alert error:", err.message);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // ==============================
  // UI
  // ==============================
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.header}>🔔 Live Alerts</Text>

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
    </Animated.View>
  );
}

// ==============================
// 🎨 PREMIUM UI
// ==============================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    paddingTop: 40,
  },

  header: {
    color: "white",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "bold",
  },

  empty: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 30,
    fontSize: 14,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  message: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  time: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 12,
  },
});