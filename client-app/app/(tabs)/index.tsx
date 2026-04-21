// app/(tabs)/index.tsx

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { socket } from "../../services/socket";
import * as Location from "expo-location";
import MapView, { Marker, AnimatedRegion, Circle } from "react-native-maps";
import * as Speech from "expo-speech";
import { Linking } from "react-native";

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

  const markerRef = useRef(
    new AnimatedRegion({
      latitude: EVENT.lat,
      longitude: EVENT.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    })
  ).current;

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    await getLocation();
    await fetchZones();
  };

  // 📍 LOCATION (SAFE)
  const getLocation = async () => {
    try {
      setLocationError(false);

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationError(true);
        Alert.alert("Enable GPS");
        return;
      }

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationError(true);
        return;
      }

      let loc;

      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 5000,
        });
      } catch {
        loc = await Location.getLastKnownPositionAsync();
      }

      if (!loc) {
        setLocationError(true);
        return;
      }

      setLocation(loc.coords);
      markerRef.setValue(loc.coords);

    } catch {
      setLocationError(true);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get("http://172.20.39.19:5000/zones");
      setZones(res.data || []);
    } catch {}
    setLoading(false);
  };

  // 🔴 REAL-TIME SYSTEM (CORE LOGIC)
  useEffect(() => {
    socket.on("zoneUpdated", (z) => {
      setZones((prev) => {
        const exists = prev.find((p) => p.gate_id === z.gate_id);

        // 🚨 ALERT SYSTEM
        if (z.futureCrowd > 85) {
          Speech.speak(`Gate ${z.gate_id} overcrowded`);
        }

        return exists
          ? prev.map((p) =>
              p.gate_id === z.gate_id ? z : p
            )
          : [...prev, z];
      });
    });

    return () => socket.off("zoneUpdated");
  }, []);

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

    const dist = getDistance(
      location.latitude,
      location.longitude,
      EVENT.lat,
      EVENT.lng
    );

    return dist <= EVENT.radius;
  };

  // 🧠 SMART ENGINE
  const gatesWithData =
    zones.length > 0 && location
      ? zones.map((z) => {
          const dist = getDistance(
            location.latitude,
            location.longitude,
            z.lat,
            z.lng
          );

          const waitTime = Math.round(
            (z.futureCrowd ?? z.crowdLevel) * 0.2
          );

          const score =
            waitTime * 0.6 + dist * 0.4;

          return { ...z, distance: dist, waitTime, score };
        })
      : [];

  const bestGate =
    gatesWithData.length > 0
      ? [...gatesWithData].sort((a, b) => a.score - b.score)[0]
      : null;

  // 🎯 AUTO GUIDANCE
  useEffect(() => {
    if (bestGate && bestGate !== currentGate) {
      setCurrentGate(bestGate);

      Speech.speak(
        `Recommended Gate ${bestGate.gate_id}. Wait time ${bestGate.waitTime} minutes`
      );
    }
  }, [bestGate]);

  // 🚀 NAVIGATION
  const navigate = (gate) => {
    Speech.speak(`Navigating to Gate ${gate.gate_id}`);

    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${gate.lat},${gate.lng}`
    );
  };

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

  // 🏠 NOT AT EVENT
  if (!isEvent()) {
    return (
      <View style={styles.home}>
        <Text style={styles.title}>🏠 Not at Event</Text>
        <Text style={styles.subtitle}>
          Move near stadium for smart experience
        </Text>
      </View>
    );
  }

  // 🏟 EVENT EXPERIENCE
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

        <Marker.Animated coordinate={markerRef} />

        {zones.map((z, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: z.lat, longitude: z.lng }}
            title={`Gate ${z.gate_id}`}
          />
        ))}
      </MapView>

      <ScrollView style={styles.panel}>
        {bestGate && (
          <View style={styles.bestBox}>
            <Text style={styles.bestText}>
              ⭐ Recommended Gate: {bestGate.gate_id}
            </Text>
            <Text style={styles.reason}>
              ⏱ Wait: {bestGate.waitTime} min
            </Text>
            <Text style={styles.reason}>
              ✔ Best balance of distance & crowd
            </Text>
          </View>
        )}

        {gatesWithData.map((g, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.gate}>Gate {g.gate_id}</Text>

            <Text style={styles.text}>
              📏 {Math.round(g.distance)}m
            </Text>

            <Text style={styles.text}>
              ⏱ Wait: {g.waitTime} min
            </Text>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigate(g)}
            >
              <Text style={styles.btnText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  home: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },

  title: { color: "white", fontSize: 22 },
  subtitle: { color: "#94a3b8", marginTop: 10 },

  panel: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    maxHeight: 320,
    backgroundColor: "#020617",
  },

  bestBox: {
    padding: 15,
    backgroundColor: "#022c22",
    margin: 10,
    borderRadius: 10,
  },

  bestText: { color: "#22c55e" },
  reason: { color: "#94a3b8" },

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