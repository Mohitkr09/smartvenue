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
import { connectSocket } from "../../services/socket";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Linking } from "react-native";

const API_URL = "https://smartvenue.online";

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

// SAFE MAP IMPORT
let MapView: any, Marker: any, Circle: any, AnimatedRegion: any;

if (Platform.OS !== "web") {
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
    Circle = maps.Circle;
    AnimatedRegion = maps.AnimatedRegion;
  } catch (err) {
    console.log("❌ Map load error:", err);
  }
}

export default function HomeScreen() {
  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bestGate, setBestGate] = useState<any>(null);

  const lastSpokenRef = useRef("");
  const lastBestGateRef = useRef("");

  const markerRef = useRef(
    Platform.OS !== "web" && AnimatedRegion
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
    let socket: any = null;

    try {
      socket = connectSocket();

      if (socket) {
        socket.on("zoneUpdate", handleRealtime);
      }
    } catch (err) {
      console.log("❌ Socket init failed:", err);
    }

    init();

    return () => {
      try {
        socket?.off("zoneUpdate", handleRealtime);
      } catch {}
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
    try {
      if (!data) return;

      setZones((prev) => {
        const updated = prev.some((z) => z.name === data.name)
          ? prev.map((z) => (z.name === data.name ? data : z))
          : [...prev, data];

        findBestGate(updated);

        // 🔊 SAFE SPEECH
        if (
          data.crowdLevel >= 85 &&
          lastSpokenRef.current !== data.name
        ) {
          try {
            Speech.stop();
            Speech.speak(`High crowd at ${data.name}`);
          } catch {}
          lastSpokenRef.current = data.name;
        }

        return updated;
      });
    } catch (err) {
      console.log("❌ realtime error:", err);
    }
  };

  // ==============================
  // 📍 LOCATION
  // ==============================
  const getLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      markerRef?.setValue({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (err) {
      console.log("❌ Location error:", err);
    }
  };

  const refreshLocation = async () => {
    await getLocation();
    try {
      Speech.speak("Location updated");
    } catch {}
  };

  // ==============================
  // 🌐 FETCH
  // ==============================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      const data = res.data || [];

      setZones(data);
      findBestGate(data);
    } catch (err: any) {
      console.log("❌ API error:", err.message);
    }

    setLoading(false);
  };

  // ==============================
  // 📏 DISTANCE
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

  const findBestGate = (data) => {
    try {
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

        const s = dist + g.crowdLevel * 10;

        if (s < score) {
          score = s;
          best = { ...g, distance: dist };
        }
      });

      setBestGate(best);

      if (best && lastBestGateRef.current !== best.name) {
        lastBestGateRef.current = best.name;

        try {
          Speech.stop();
          Speech.speak(`Best gate is ${best.name}`);
        } catch {}
      }
    } catch (err) {
      console.log("❌ best gate error:", err);
    }
  };

  const navigate = (gate) => {
    try {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${gate.lat},${gate.lng}`
      );
    } catch (err) {
      console.log("❌ map open error:", err);
    }
  };

  // ==============================
  // UI SAFETY
  // ==============================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (Platform.OS === "web" || !MapView) {
    return (
      <View style={styles.center}>
        <Text>Map not supported</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "white" }}>Getting location...</Text>
      </View>
    );
  }

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

        {markerRef && <Marker.Animated coordinate={markerRef} />}

        {zones.map((z, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: z.lat, longitude: z.lng }}
            title={z.name}
          />
        ))}
      </MapView>

      <ScrollView style={styles.panel}>
        <TouchableOpacity style={styles.refresh} onPress={refreshLocation}>
          <Text style={{ color: "white" }}>Refresh Location</Text>
        </TouchableOpacity>

        {!bestGate && (
          <Text style={styles.noEvent}>No event detected</Text>
        )}

        {bestGate && (
          <View style={styles.best}>
            <Text style={styles.bestText}>
              ⭐ {bestGate.name}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  noEvent: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 10,
  },
});