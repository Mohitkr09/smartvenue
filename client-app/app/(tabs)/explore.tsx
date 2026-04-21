// app/(tabs)/explore.tsx

import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";

import { useEffect, useState } from "react";
import axios from "axios";
import * as Location from "expo-location";
import { io } from "socket.io-client";

// ✅ FIX: conditional map import
let MapView: any, Marker: any;

if (Platform.OS !== "web") {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
}

// 🔥 USE YOUR EC2 URL
const BASE_URL = "http://34.233.135.146:5001";
const socket = io(BASE_URL);

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

export default function Explore() {
  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getLocation();
    fetchZones();
  }, []);

  const getLocation = async () => {
    let { status } =
      await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/zones`);
      setZones(res.data || []);
    } catch (err: any) {
      console.log("API Error:", err.message);
    }
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchZones();
  };

  // 🔌 SOCKET
  useEffect(() => {
    socket.on("zoneUpdate", (z) => {
      console.log("📡 LIVE:", z);

      setZones((prev) => {
        const exists = prev.find((p) => p.name === z.name);
        return exists
          ? prev.map((p) => (p.name === z.name ? z : p))
          : [...prev, z];
      });
    });

    return () => socket.off("zoneUpdate");
  }, []);

  // 📏 DISTANCE
  const getDistance = (zone) => {
    if (!location || !zone.lat) return 99999;

    const R = 6371;
    const dLat = (zone.lat - location.latitude) * Math.PI / 180;
    const dLon = (zone.lng - location.longitude) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(location.latitude * Math.PI / 180) *
        Math.cos(zone.lat * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return Math.round(
      R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000
    );
  };

  const getETA = (d) => Math.max(1, Math.round(d / 80));

  const isEvent = () => {
    if (!location) return false;

    return (
      getDistance({
        lat: EVENT.lat,
        lng: EVENT.lng,
      }) <= EVENT.radius
    );
  };

  // 🏆 BEST GATE
  const bestGate =
    zones.length > 0
      ? [...zones]
          .map((z) => ({
            ...z,
            score:
              (z.crowdLevel ?? 0) * 0.7 +
              getDistance(z) * 0.3,
          }))
          .sort((a, b) => a.score - b.score)[0]
      : null;

  const openNavigation = (gate) => {
    if (!location) return;

    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${gate.lat},${gate.lng}`
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🔍 Smart Explore</Text>

      {/* ❌ WEB FALLBACK */}
      {Platform.OS === "web" && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            🖥️ Map not supported on web
          </Text>
        </View>
      )}

      {/* ❌ NO EVENT */}
      {!isEvent() && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            🚫 Not at event location
          </Text>
        </View>
      )}

      {/* ✅ MAP (ONLY MOBILE) */}
      {Platform.OS !== "web" && isEvent() && (
        <MapView
          style={styles.map}
          showsUserLocation
          region={{
            latitude: location?.latitude || EVENT.lat,
            longitude: location?.longitude || EVENT.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          {zones.map((z, i) => (
            <Marker
              key={i}
              coordinate={{ latitude: z.lat, longitude: z.lng }}
              title={z.name}
            />
          ))}
        </MapView>
      )}

      {/* 📋 LIST */}
      <FlatList
        data={zones}
        keyExtractor={(item, i) => `gate-${i}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          const dist = getDistance(item);
          const eta = getETA(dist);
          const isBest = bestGate?.name === item.name;

          return (
            <View style={[styles.card, isBest && styles.bestCard]}>
              <Text style={styles.title}>
                {item.name} {isBest && "⭐ BEST"}
              </Text>

              <Text style={styles.text}>
                📏 {dist} m | ⏱ {eta} min
              </Text>

              <Text style={styles.text}>
                👥 {item.crowdLevel}%
              </Text>

              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => openNavigation(item)}
              >
                <Text style={styles.navText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

// 🎨 STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", paddingTop: 40 },
  header: { color: "white", fontSize: 24, textAlign: "center", fontWeight: "bold" },
  map: { height: 200, margin: 10, borderRadius: 10 },
  emptyBox: { marginTop: 100, alignItems: "center" },
  emptyText: { color: "#ef4444", fontSize: 16, textAlign: "center" },
  card: { backgroundColor: "#1e293b", margin: 10, padding: 15, borderRadius: 12 },
  bestCard: { borderColor: "#22c55e", borderWidth: 2 },
  title: { color: "white", fontSize: 18, fontWeight: "bold" },
  text: { color: "#94a3b8" },
  navBtn: { marginTop: 10, backgroundColor: "#3b82f6", padding: 10, borderRadius: 8, alignItems: "center" },
  navText: { color: "white", fontWeight: "bold" },
});