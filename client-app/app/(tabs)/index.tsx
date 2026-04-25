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
import { connectSocket } from "../../services/socket";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Linking } from "react-native";

// ✅ SAFE IMPORT (no dynamic require)
import MapView, { Marker, Circle } from "react-native-maps";

const API_URL = "https://smartvenue.online";

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

  const lastSpokenRef = useRef("");
  const lastBestGateRef = useRef("");

  // ==============================
  // INIT
  // ==============================
  useEffect(() => {
    let socket: any;

    try {
      socket = connectSocket();
      socket?.on("zoneUpdate", handleRealtime);
    } catch (err) {
      console.log("Socket error:", err);
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
  // SAFE SPEECH
  // ==============================
  const speak = (text: string) => {
    try {
      if (Platform.OS !== "web") {
        Speech.stop();
        Speech.speak(text);
      }
    } catch (e) {
      console.log("Speech error:", e);
    }
  };

  // ==============================
  // REALTIME
  // ==============================
  const handleRealtime = (data: any) => {
    try {
      if (!data) return;

      setZones((prev) => {
        const updated = prev.some((z) => z.name === data.name)
          ? prev.map((z) => (z.name === data.name ? data : z))
          : [...prev, data];

        findBestGate(updated);

        if (
          data.crowdLevel >= 85 &&
          lastSpokenRef.current !== data.name
        ) {
          speak(`High crowd at ${data.name}`);
          lastSpokenRef.current = data.name;
        }

        return updated;
      });
    } catch (err) {
      console.log("Realtime error:", err);
    }
  };

  // ==============================
  // LOCATION
  // ==============================
  const getLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Permission denied");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      if (!loc?.coords) return;

      setLocation(loc.coords);
    } catch (err) {
      console.log("Location error:", err);
    }
  };

  const refreshLocation = async () => {
    await getLocation();
    speak("Location updated");
  };

  // ==============================
  // FETCH
  // ==============================
  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      const data = res?.data || [];

      setZones(data);
      findBestGate(data);
    } catch (err: any) {
      console.log("API error:", err?.message);
    }

    setLoading(false);
  };

  // ==============================
  // DISTANCE
  // ==============================
  const getDistance = (lat1, lon1, lat2, lon2) => {
    try {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;

      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
    } catch {
      return 0;
    }
  };

  const findBestGate = (data) => {
    try {
      if (!location || !data?.length) return;

      let best = null;
      let score = Infinity;

      data.forEach((g) => {
        if (!g?.lat || !g?.lng) return;

        const dist = getDistance(
          location.latitude,
          location.longitude,
          g.lat,
          g.lng
        );

        const s = dist + (g.crowdLevel || 0) * 10;

        if (s < score) {
          score = s;
          best = { ...g, distance: dist };
        }
      });

      setBestGate(best);

      if (best && lastBestGateRef.current !== best.name) {
        lastBestGateRef.current = best.name;
        speak(`Best gate is ${best.name}`);
      }
    } catch (err) {
      console.log("Best gate error:", err);
    }
  };

  const navigate = (gate) => {
    try {
      if (!gate?.lat || !gate?.lng) return;

      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${gate.lat},${gate.lng}`
      );
    } catch (err) {
      console.log("Navigation error:", err);
    }
  };

  // ==============================
  // UI STATES
  // ==============================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (
    !location ||
    !location.latitude ||
    !location.longitude
  ) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "white" }}>
          Getting location...
        </Text>
      </View>
    );
  }

  // ==============================
  // UI
  // ==============================
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

        {/* User Marker */}
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You"
        />

        {/* Gates */}
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
          <Text style={{ color: "white" }}>
            Refresh Location
          </Text>
        </TouchableOpacity>

        {!bestGate && (
          <Text style={styles.noEvent}>
            No event detected
          </Text>
        )}

        {bestGate && (
          <View style={styles.best}>
            <Text style={styles.bestText}>
              ⭐ {bestGate.name}
            </Text>

            <TouchableOpacity
              onPress={() => navigate(bestGate)}
              style={{ marginTop: 10 }}
            >
              <Text style={{ color: "white" }}>
                Open in Maps
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ==============================
// STYLES
// ==============================
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  bestText: {
    color: "white",
    fontWeight: "bold",
  },
  noEvent: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 10,
  },
});