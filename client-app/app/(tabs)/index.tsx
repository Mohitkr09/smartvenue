import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Linking } from "react-native";
import { io } from "socket.io-client";
import polyline from "@mapbox/polyline";
import { Polyline } from "react-native-maps";

const API_URL = "https://smartvenue.online";
const socket = io(API_URL);

let MapView: any, Marker: any;

if (Platform.OS !== "web") {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
}

export default function HomeScreen() {
  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [bestGate, setBestGate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [distanceLeft, setDistanceLeft] = useState(0);
  const [direction, setDirection] = useState("⬆️");
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [eta, setEta] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastSpeech = useRef("");
  const lastDistanceCall = useRef(0);

  // ================= INIT =================
  useEffect(() => {
    startTracking();
    fetchZones();

    socket.on("zoneUpdate", (data) => {
      const best = data.find((z: any) => z.isBest);
      if (best) setBestGate(best);
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    return () => socket.disconnect();
  }, []);

  // ================= FETCH ZONES =================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      setZones(res.data || []);
    } catch (err) {
      console.log("❌ Zone error:", err.message);
    }
    setLoading(false);
  };

  // ================= GPS =================
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (loc) => {
        const coords = loc.coords;
        setLocation(coords);

        if (zones.length && bestGate) {
          const gate = zones.find(
            (z) => z.name === `Gate ${bestGate.id}`
          );
          if (gate) updateNavigation(coords, gate);
        }
      }
    );
  };

  // ================= DISTANCE =================
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ================= DIRECTION =================
  const getDirection = (lat1, lon1, lat2, lon2) => {
    const angle = Math.atan2(lat2 - lat1, lon2 - lon1);
    const deg = (angle * 180) / Math.PI;

    if (deg > -22 && deg <= 22) return "➡️";
    if (deg > 22 && deg <= 67) return "↗️";
    if (deg > 67 && deg <= 112) return "⬆️";
    if (deg > 112 && deg <= 157) return "↖️";
    if (deg > 157 || deg <= -157) return "⬅️";
    if (deg > -157 && deg <= -112) return "↙️";
    if (deg > -112 && deg <= -67) return "⬇️";
    return "↘️";
  };

  // ================= COLOR =================
  const getColor = (crowd) => {
    if (crowd > 80) return "red";
    if (crowd > 60) return "orange";
    if (crowd > 40) return "yellow";
    return "green";
  };

  // ================= VOICE =================
  const speak = (text) => {
    if (lastSpeech.current !== text) {
      Speech.speak(text);
      lastSpeech.current = text;
    }
  };

  // ================= ROUTE =================
  const fetchRoute = async (user, gate) => {
    try {
      const res = await axios.post(`${API_URL}/route`, {
        origin: { lat: user.latitude, lng: user.longitude },
        destination: { lat: gate.lat, lng: gate.lng },
      });

      const points = polyline.decode(
        res.data.routes[0].overview_polyline.points
      );

      setRouteCoords(
        points.map((p) => ({
          latitude: p[0],
          longitude: p[1],
        }))
      );

      const duration = res.data.routes[0].legs[0].duration.value;
      setEta(Math.round(duration / 60));
    } catch (err) {
      console.log("❌ Route error:", err.message);
    }
  };

  // ================= NAVIGATION =================
  const updateNavigation = (user, gate) => {
    const dist = getDistance(
      user.latitude,
      user.longitude,
      gate.lat,
      gate.lng
    );

    setDistanceLeft(dist);

    const dir = getDirection(
      user.latitude,
      user.longitude,
      gate.lat,
      gate.lng
    );

    setDirection(dir);

    if (routeCoords.length === 0 || Math.random() < 0.05) {
      fetchRoute(user, gate);
    }

    if (Math.abs(dist - lastDistanceCall.current) > 50) {
      speak(`${Math.round(dist)} meters remaining`);
      lastDistanceCall.current = dist;
    }

    if (dir === "⬅️") speak("Turn left");
    if (dir === "➡️") speak("Turn right");

    if (bestGate?.status === "HIGH") {
      speak("This gate is crowded");
    }

    if (dist < 30) {
      speak("You have reached your gate");
    }
  };

  // ================= LOADING =================
  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // ================= UI =================
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <MapView
        style={styles.map}
        showsUserLocation
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {zones.map((z, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: z.lat, longitude: z.lng }}
            pinColor={getColor(z.crowdLevel)}
          />
        ))}

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={4}
            strokeColor="#2563eb"
          />
        )}
      </MapView>

      <View style={styles.card}>
        <Text style={styles.arrow}>{direction}</Text>

        {bestGate && (
          <>
            <Text style={styles.gate}>
              🚪 Gate {bestGate.id} {bestGate.isBest ? "🏆" : ""}
            </Text>

            <Text style={styles.info}>
              🔮 Future: {bestGate.futureCrowd}
            </Text>

            <Text style={styles.info}>
              📊 Status: {bestGate.status}
            </Text>

            <Text style={styles.info}>
              📍 {Math.round(distanceLeft)} m
            </Text>

            <Text style={styles.info}>
              ⏱ ETA: {eta} min
            </Text>

            {/* ✅ FIXED BUTTON */}
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                const gate = zones.find(
                  (z) => z.name === `Gate ${bestGate.id}`
                );
                if (!gate) return;

                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${gate.lat},${gate.lng}&travelmode=walking`
                );
              }}
            >
              <Text style={styles.btnText}>
                🧭 Open Google Maps
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  map: { flex: 1 },

  card: {
    position: "absolute",
    bottom: 20,
    left: 15,
    right: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 20,
    borderRadius: 20,
  },

  arrow: {
    fontSize: 40,
    textAlign: "center",
  },

  gate: {
    color: "white",
    fontSize: 22,
    textAlign: "center",
    fontWeight: "bold",
  },

  info: {
    color: "#cbd5f5",
    textAlign: "center",
    marginTop: 5,
  },

  btn: {
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
  },

  btnText: {
    color: "white",
    fontWeight: "bold",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },
});