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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

const API_URL = "https://smartvenue.online";

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
  const [isInEvent, setIsInEvent] = useState(false);
  const [userName, setUserName] = useState("");
  const [distanceLeft, setDistanceLeft] = useState(0);
  const [direction, setDirection] = useState("⬆️");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastSpeech = useRef("");
  const lastDistanceCall = useRef(0);

  // ================= INIT =================
  useEffect(() => {
    fetchUser();
    startTracking();
    fetchZones();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // ================= USER =================
  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserName(res?.data?.user?.name || "");
    } catch {}
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

        if (zones.length) {
          checkEvent(coords);
          const gate = findBestGate(zones, coords);
          if (gate) updateNavigation(coords, gate);
        }
      }
    );
  };

  // ================= FETCH =================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      setZones(res.data || []);
    } catch {}
    setLoading(false);
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

  // ================= EVENT =================
  const checkEvent = (coords) => {
    let inside = false;

    zones.forEach((z) => {
      if (
        getDistance(coords.latitude, coords.longitude, z.lat, z.lng) < 500
      ) {
        inside = true;
      }
    });

    setIsInEvent(inside);
  };

  // ================= BEST GATE =================
  const findBestGate = (data, loc) => {
    let best = null;
    let score = Infinity;

    data.forEach((g) => {
      const dist = getDistance(loc.latitude, loc.longitude, g.lat, g.lng);
      const s = dist + g.crowdLevel * 12;

      if (s < score) {
        score = s;
        best = { ...g, distance: dist };
      }
    });

    setBestGate(best);

    if (best && lastSpeech.current !== best.name) {
      Speech.speak(`Best gate is ${best.name}`);
      lastSpeech.current = best.name;
    }

    return best;
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

    // 🔊 Distance voice (every ~50m)
    if (Math.abs(dist - lastDistanceCall.current) > 50) {
      Speech.speak(`${Math.round(dist)} meters remaining`);
      lastDistanceCall.current = dist;
    }

    // 🔊 Arrival
    if (dist < 30) {
      Speech.speak("You have reached your gate");
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

  // ================= HOME =================
  if (!isInEvent) {
    return (
      <View style={styles.center}>
        <Text style={styles.homeTitle}>
          Hi, {userName || "User"} 👋
        </Text>
        <Text style={styles.homeSub}>🏠 You are at home</Text>
      </View>
    );
  }

  // ================= EVENT =================
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
          />
        ))}
      </MapView>

      {/* NAV CARD */}
      <View style={styles.card}>
        <Text style={styles.arrow}>{direction}</Text>

        {bestGate && (
          <>
            <Text style={styles.gate}>{bestGate.name}</Text>

            <Text style={styles.info}>
              📍 Distance: {Math.round(distanceLeft)} m
            </Text>

            <Text style={styles.info}>
              ⏱ Time: {Math.max(1, Math.round(distanceLeft / 80))} min
            </Text>

            <Text style={styles.info}>
              👥 Crowd: {bestGate.crowdLevel}%
            </Text>

            <TouchableOpacity
              style={styles.btn}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${bestGate.lat},${bestGate.lng}`
                )
              }
            >
              <Text style={styles.btnText}>Start Navigation</Text>
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
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 20,
    borderRadius: 20,
  },

  arrow: {
    fontSize: 40,
    textAlign: "center",
  },

  gate: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
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

  homeTitle: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
  },

  homeSub: {
    color: "#94a3b8",
    marginTop: 10,
  },
});