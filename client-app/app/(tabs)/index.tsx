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
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://smartvenue.online";

// keep all imports same

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [bestGate, setBestGate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [userName, setUserName] = useState("User");
  const [isInEvent, setIsInEvent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastSpeech = useRef("");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    await fetchUser();
    await fetchZones();
    await startTracking();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  // ================= USER =================
  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserName(res?.data?.user?.name || "User");
    } catch {}
  };

  // ================= LOCATION =================
  const startTracking = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocation({
          latitude: EVENT.lat,
          longitude: EVENT.lng,
        });
        return;
      }

      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const coords = loc.coords;
          setLocation(coords);

          const d = getDistance(
            coords.latitude,
            coords.longitude,
            EVENT.lat,
            EVENT.lng
          );

          setIsInEvent(d <= EVENT.radius);

          if (bestGate) {
            updateNavigation(coords, bestGate);
          }
        }
      );
    } catch {
      setLocation({
        latitude: EVENT.lat,
        longitude: EVENT.lng,
      });
    }
  };

  // ================= FETCH =================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      const data = res.data || [];
      setZones(data);

      if (data.length > 0) {
        const best = data
          .map((z) => ({
            ...z,
            score: (z.crowdLevel ?? 0) * 0.7,
          }))
          .sort((a, b) => a.score - b.score)[0];

        setBestGate(best);
      }
    } catch {
      setZones([]);
    }
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

      if (!res.data?.routes?.length) return;

      const route = res.data.routes[0];

      const points = polyline.decode(
        route.overview_polyline.points
      );

      setRouteCoords(
        points.map((p) => ({
          latitude: p[0],
          longitude: p[1],
        }))
      );

      setEta(Math.round(route.legs[0].duration.value / 60));
      setDistance(Math.round(route.legs[0].distance.value));
    } catch {}
  };

  const updateNavigation = (user, gate) => {
    const dist = getDistance(
      user.latitude,
      user.longitude,
      gate.lat,
      gate.lng
    );

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

  // ================= NO EVENT (UNCHANGED UI) =================
  if (!isInEvent) {
    return (
      <Animated.View style={[styles.homeContainer, { opacity: fadeAnim }]}>
        <Image
          source={{
            uri: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
          }}
          style={styles.homeImage}
        />

        <Text style={styles.homeTitle}>Hi, {userName} 👋</Text>

        <Text style={styles.homeSubtitle}>
          No event detected nearby
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={fetchZones}>
          <Text style={styles.primaryText}>Refresh</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ================= EVENT UI =================
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* SMALL MAP */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
        >
          {zones.map((z, i) => (
            <Marker
              key={i}
              coordinate={{ latitude: z.lat, longitude: z.lng }}
            />
          ))}

          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeWidth={5}
              strokeColor="#3b82f6"
            />
          )}
        </MapView>
      </View>

      {/* INFO CARD */}
      <View style={[styles.card, { bottom: insets.bottom + 90 }]}>
        <Text style={styles.banner}>🎉 Inside Event</Text>

        <Text style={styles.gate}>Gate {bestGate?.id}</Text>

        <Text style={styles.info}>
          🚦 {bestGate?.crowdLevel}% • ⏱ {eta} min
        </Text>

        <Text style={styles.info}>
          📏 {distance} meters
        </Text>

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