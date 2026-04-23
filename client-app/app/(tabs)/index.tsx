import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { connectSocket, getSocket } from "../../services/socket";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Linking } from "react-native";

// ==============================
// 🧠 CONFIG
// ==============================

// ✅ USE ELASTIC IP (FINAL FIX)
const API_URL = "http://18.214.178.1:5000";

// MAP SAFE IMPORT
let MapView: any, Marker: any, Circle: any, AnimatedRegion: any;

if (Platform.OS !== "web") {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Circle = maps.Circle;
  AnimatedRegion = maps.AnimatedRegion;
}

// ==============================
// 📍 EVENT LOCATION
// ==============================
const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

export default function HomeScreen() {
  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bestGate, setBestGate] = useState<any>(null);

  const markerRef = useRef(
    Platform.OS !== "web"
      ? new AnimatedRegion({
          latitude: EVENT.lat,
          longitude: EVENT.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        })
      : null
  ).current;

  // ==============================
  // 🚀 INIT
  // ==============================
  useEffect(() => {
    console.log("🚀 Connecting socket...");

    connectSocket(API_URL); // ✅ IMPORTANT FIX

    const socket = getSocket();

    socket.on("connect", () => {
      console.log("🟢 Socket Connected:", socket.id);
    });

    socket.on("zoneUpdate", handleRealtime);

    socket.on("connect_error", (err) => {
      console.log("❌ Socket Error:", err.message);
    });

    init();

    return () => {
      socket.off("zoneUpdate", handleRealtime);
      socket.disconnect();
    };
  }, []);

  const init = async () => {
    await getLocation();
    await fetchZones();
  };

  // ==============================
  // 📡 REAL-TIME HANDLER
  // ==============================
  const handleRealtime = (data: any) => {
    console.log("🔥 LIVE UPDATE:", data);

    setZones((prev) => {
      const exists = prev.find((z) => z.name === data.name);

      // 🔊 Voice alert
      if (data.crowdLevel >= 85) {
        Speech.speak(`High crowd at ${data.name}`);
      }

      const updated = exists
        ? prev.map((z) => (z.name === data.name ? data : z))
        : [...prev, data];

      findBestGate(updated);
      return updated;
    });
  };

  // ==============================
  // 📍 LOCATION
  // ==============================
  const getLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission required");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      if (markerRef) {
        markerRef.setValue(loc.coords);
      }
    } catch (err) {
      console.log("Location error:", err);
    }
  };

  // ==============================
  // 🔄 REFRESH LOCATION
  // ==============================
  const refreshLocation = async () => {
    await getLocation();
    Speech.speak("Location updated");
  };

  // ==============================
  // 🌐 FETCH ZONES
  // ==============================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      const data = res.data || [];

      console.log("📦 Zones fetched:", data);

      setZones(data);
      findBestGate(data);
    } catch (err) {
      console.log("❌ Fetch error:", err.message);
    }

    setLoading(false);
  };

  // ==============================
  // 📏 DISTANCE CALC
  // ==============================
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
  };

  // ==============================
  // 🧠 BEST GATE LOGIC
  // ==============================
  const findBestGate = (data) => {
    if (!location || !data.length) return;

    let best = null;
    let score = Infinity;

    data.forEach((g) => {
      const dist = getDistance(
        location.latitude,
        location.longitude,
        g.lat,
        g.lng
      );

      const currentScore = dist + g.crowdLevel * 10;

      if (currentScore < score) {
        score = currentScore;
        best = g;
      }
    });

    setBestGate(best);

    if (best) {
      Speech.speak(`Best gate is ${best.name}`);
    }
  };

  // ==============================
  // 🚀 NAVIGATION
  // ==============================
  const navigate = (gate) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${gate.lat},${gate.lng}`
    );

    Speech.speak(`Navigating to ${gate.name}`);
  };

  // ==============================
  // ⏳ LOADING
  // ==============================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.center}>
        <Text>🖥️ Map not supported on web</Text>
      </View>
    );
  }

  // ==============================
  // 🗺️ UI
  // ==============================
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        showsUserLocation
        region={{
          latitude: location?.latitude || EVENT.lat,
          longitude: location?.longitude || EVENT.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Circle
          center={{ latitude: EVENT.lat, longitude: EVENT.lng }}
          radius={EVENT.radius}
          strokeColor="#22c55e"
        />

        <Marker.Animated coordinate={markerRef} />

        {zones.map((z, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: z.lat, longitude: z.lng }}
            title={z.name}
          />
        ))}
      </MapView>

      {/* 🔥 PANEL */}
      <ScrollView style={styles.panel}>
        <TouchableOpacity style={styles.refresh} onPress={refreshLocation}>
          <Text style={{ color: "white" }}>🔄 Refresh Location</Text>
        </TouchableOpacity>

        {!zones.length && (
          <Text style={styles.text}>❌ No event detected</Text>
        )}

        {bestGate && (
          <View style={styles.best}>
            <Text style={styles.bestText}>
              ⭐ Best Gate: {bestGate.name}
            </Text>
          </View>
        )}

        {zones.map((g, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.gate}>{g.name}</Text>

            <Text style={styles.text}>
              👥 Crowd: {g.crowdLevel}
            </Text>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigate(g)}
            >
              <Text style={styles.btnText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ==============================
// 🎨 STYLES
// ==============================
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  panel: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    maxHeight: 320,
    backgroundColor: "#020617",
  },

  refresh: {
    padding: 10,
    backgroundColor: "#334155",
    alignItems: "center",
  },

  best: {
    backgroundColor: "#22c55e",
    padding: 10,
    margin: 10,
    borderRadius: 10,
  },

  bestText: { color: "white", fontWeight: "bold" },

  card: {
    backgroundColor: "#1e293b",
    margin: 10,
    padding: 15,
    borderRadius: 12,
  },

  gate: { color: "white", fontSize: 18 },
  text: { color: "#94a3b8" },

  btn: {
    marginTop: 10,
    backgroundColor: "#22c55e",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  btnText: { color: "white", fontWeight: "bold" },
});