import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { connectSocket, getSocket } from "../../services/socket";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Linking } from "react-native";

// ✅ SAFE MAP IMPORT
let MapView: any, Marker: any, Circle: any;

if (Platform.OS !== "web") {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Circle = maps.Circle;
}

const BASE_URL = "http://34.233.135.146:5001";

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

export default function HomeScreen() {
  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [currentGate, setCurrentGate] = useState<any>(null);

  const markerRef = useRef(null);

  useEffect(() => {
    init();
    setupSocket();
  }, []);

  const init = async () => {
    await getLocation();
    await fetchZones();
  };

  // 🔌 SOCKET
  const setupSocket = () => {
    connectSocket();
    const socket = getSocket();

    socket.on("zoneUpdate", (z) => {
      console.log("📡 LIVE:", z);

      setZones((prev) => {
        const exists = prev.find((p) => p.name === z.name);

        if (z.crowdLevel > 85) {
          Speech.speak(`Gate ${z.name} overcrowded`);
        }

        return exists
          ? prev.map((p) => (p.name === z.name ? z : p))
          : [...prev, z];
      });
    });
  };

  // 📍 LOCATION
  const getLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") return setLocationError(true);

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    } catch {
      setLocationError(true);
    }
  };

  // 🌐 FETCH ZONES
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/zones`);
      setZones(res.data || []);
    } catch (err: any) {
      console.log("API Error:", err.message);
    }
    setLoading(false);
  };

  // 📏 DISTANCE
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
  };

  const isEvent = () => {
    if (!location) return false;

    return (
      getDistance(
        location.latitude,
        location.longitude,
        EVENT.lat,
        EVENT.lng
      ) <= EVENT.radius
    );
  };

  // 🧠 LOGIC
  const gatesWithData =
    zones.length > 0 && location
      ? zones.map((z) => {
          const dist = getDistance(
            location.latitude,
            location.longitude,
            z.lat,
            z.lng
          );

          const waitTime = Math.round(z.crowdLevel * 0.2);
          const score = waitTime * 0.6 + dist * 0.4;

          return { ...z, distance: dist, waitTime, score };
        })
      : [];

  const bestGate =
    gatesWithData.length > 0
      ? [...gatesWithData].sort((a, b) => a.score - b.score)[0]
      : null;

  useEffect(() => {
    if (bestGate && bestGate !== currentGate) {
      setCurrentGate(bestGate);

      Speech.speak(
        `Go to ${bestGate.name}. Wait time ${bestGate.waitTime} minutes`
      );
    }
  }, [bestGate]);

  const navigate = (gate) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${gate.lat},${gate.lng}`
    );
  };

  // 🖥️ WEB FALLBACK
  if (Platform.OS === "web") {
    return (
      <View style={styles.center}>
        <Text style={{ color: "white" }}>
          🖥️ Map not supported on web
        </Text>
        <Text style={{ color: "gray" }}>
          Use mobile for map view
        </Text>
      </View>
    );
  }

  // ⏳ LOADING
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // ❌ LOCATION ERROR
  if (locationError || !location) {
    return (
      <View style={styles.home}>
        <Text style={styles.title}>📍 Location Required</Text>
        <TouchableOpacity style={styles.btn} onPress={getLocation}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ❌ NOT IN EVENT
  if (!isEvent()) {
    return (
      <View style={styles.home}>
        <Text style={styles.title}>🏠 Not at Event</Text>
      </View>
    );
  }

  // 🗺️ MAP UI
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        showsUserLocation
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Circle
          center={{ latitude: EVENT.lat, longitude: EVENT.lng }}
          radius={EVENT.radius}
          strokeColor="#22c55e"
        />

        {/* ✅ FIXED (NO Animated Marker) */}
        <Marker coordinate={location} title="You" />

        {zones.map((z, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: z.lat, longitude: z.lng }}
            title={z.name}
          />
        ))}
      </MapView>

      <ScrollView style={styles.panel}>
        {bestGate && (
          <View style={styles.bestBox}>
            <Text style={styles.bestText}>
              ⭐ Best Gate: {bestGate.name}
            </Text>
            <Text style={styles.reason}>
              ⏱ {bestGate.waitTime} min
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#020617" },
  home: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#020617" },
  title: { color: "white", fontSize: 22 },
  panel: { position: "absolute", bottom: 0, width: "100%", maxHeight: 320, backgroundColor: "#020617" },
  bestBox: { padding: 15, backgroundColor: "#022c22", margin: 10, borderRadius: 10 },
  bestText: { color: "#22c55e" },
  reason: { color: "#94a3b8" },
  btn: { marginTop: 10, backgroundColor: "#22c55e", padding: 10, borderRadius: 8, alignItems: "center" },
  btnText: { color: "white", fontWeight: "bold" },
});