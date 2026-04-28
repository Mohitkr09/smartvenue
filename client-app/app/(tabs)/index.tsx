import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Linking } from "react-native";
import { io } from "socket.io-client";
import polyline from "@mapbox/polyline";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_URL = "https://smartvenue.online";
const socket = io(API_URL);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [bestGate, setBestGate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [distanceLeft, setDistanceLeft] = useState(0);
  const [eta, setEta] = useState(0);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastSpeech = useRef("");

  const USER_NAME = "Mohit";

  // ================= INIT =================
  useEffect(() => {
    startTracking();
    fetchZones();

    socket.on("zoneUpdate", (data) => {
      const best = data.find((z: any) => z.isBest);
      if (best) {
        setBestGate(best);

        // 🔥 AUTO REROUTE
        if (location) {
          const gate = data.find((z) => z.id === best.id);
          if (gate) fetchRoute(location, gate);
        }
      }
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    return () => socket.disconnect();
  }, [location]);

  // ================= FETCH =================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      setZones(res.data || []);
    } catch {}
    setLoading(false);
  };

  // ================= GPS =================
  const startTracking = async () => {
    const { status } =
      await Location.requestForegroundPermissionsAsync();

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

  // ================= VOICE =================
  const speak = (text: string) => {
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
    } catch {}
  };

  const updateNavigation = (user, gate) => {
    const dist = getDistance(
      user.latitude,
      user.longitude,
      gate.lat,
      gate.lng
    );

    setDistanceLeft(dist);

    if (routeCoords.length === 0) {
      fetchRoute(user, gate);
    }

    if (dist < 100) speak("You are near your gate");
  };

  // ================= LOADING =================
  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // ================= NO EVENT =================
  if (!bestGate) {
    return (
      <Animated.View style={[styles.homeContainer, { opacity: fadeAnim }]}>
        <Image
          source={{
            uri: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
          }}
          style={styles.homeImage}
        />

        <Text style={styles.homeTitle}>Hi, {USER_NAME} 👋</Text>
        <Text style={styles.homeSubtitle}>
          No event detected nearby
        </Text>

        <View style={styles.homeCard}>
          <Text style={styles.homeCardText}>📍 Location active</Text>
          <Text style={styles.homeTip}>
            Move closer to event venue
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={fetchZones}>
          <Text style={styles.primaryText}>Refresh</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ================= EVENT MODE =================
  const confidence = Math.min(
    95,
    60 + (100 - bestGate.futureCrowd) * 0.3
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <MapView style={styles.map} showsUserLocation>
        {zones.map((z, i) => {
          const color =
            z.crowdLevel > 70
              ? "red"
              : z.crowdLevel < 30
              ? "green"
              : "orange";

          return (
            <Marker
              key={i}
              coordinate={{ latitude: z.lat, longitude: z.lng }}
              pinColor={color}
            />
          );
        })}

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor="#3b82f6"
          />
        )}
      </MapView>

      <View style={[styles.card, { bottom: insets.bottom + 90 }]}>
        <Text style={styles.banner}>🎉 You are at event</Text>

        <Text style={styles.gate}>
          🧠 Gate {bestGate.id} is best
        </Text>

        <Text style={styles.confidence}>
          Confidence: {Math.round(confidence)}%
        </Text>

        <Text style={styles.info}>
          Crowd: {bestGate.futureCrowd}%
        </Text>

        <View style={styles.crowdBar}>
          <View
            style={[
              styles.crowdFill,
              {
                width: `${bestGate.futureCrowd}%`,
                backgroundColor:
                  bestGate.futureCrowd > 70
                    ? "#ef4444"
                    : "#22c55e",
              },
            ]}
          />
        </View>

        <Text style={styles.tip}>
          👉 Move towards Gate {bestGate.id}
        </Text>

        <Text style={styles.info}>
          📍 {Math.round(distanceLeft)} m • ⏱ {eta} min
        </Text>

        {bestGate.futureCrowd > 80 && (
          <Text style={styles.warning}>
            ⚠️ Heavy crowd detected
          </Text>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/dir/?api=1&destination=${bestGate.lat},${bestGate.lng}`
            )
          }
        >
          <Text style={styles.btnText}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  banner: {
    textAlign: "center",
    color: "#22c55e",
    fontWeight: "bold",
  },

  confidence: {
    textAlign: "center",
    color: "#64748b",
  },

  crowdBar: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    marginVertical: 8,
  },

  crowdFill: {
    height: 6,
    borderRadius: 10,
  },

  tip: {
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },

  warning: {
    color: "#ef4444",
    textAlign: "center",
  },

  homeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 20,
  },

  homeImage: { width: 120, height: 120, marginBottom: 20 },

  homeTitle: {
    fontSize: 26,
    fontWeight: "bold",
  },

  homeSubtitle: {
    color: "#64748b",
  },

  homeCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },

  homeCardText: {
    fontWeight: "bold",
  },

  homeTip: {
    color: "#64748b",
  },

  primaryBtn: {
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },

  primaryText: { color: "white" },

  card: {
    position: "absolute",
    left: 15,
    right: 15,
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    elevation: 10,
  },

  gate: {
    textAlign: "center",
    fontWeight: "bold",
  },

  info: {
    textAlign: "center",
    color: "#64748b",
  },

  btn: {
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    alignItems: "center",
  },

  btnText: { color: "white", fontWeight: "bold" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});