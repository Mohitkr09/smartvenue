import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useEffect, useState } from "react";
import axios from "axios";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { connectSocket } from "../../services/socket";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_URL = "https://smartvenue.online";

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

export default function Explore() {
  const insets = useSafeAreaInsets();

  const [zones, setZones] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    await getLocation();
    await fetchZones();

    const socket = connectSocket();
    socket.on("zoneUpdate", handleRealtime);

    return () => socket.off("zoneUpdate", handleRealtime);
  };

  const handleRealtime = (z: any) => {
    setZones((prev) => {
      const exists = prev.find((p) => p.name === z.name);
      return exists
        ? prev.map((p) => (p.name === z.name ? z : p))
        : [...prev, z];
    });
  };

  const getLocation = async () => {
    const { status } =
      await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_URL}/zones`);
      setZones(res.data || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchZones();
  };

  const getDistance = (zone) => {
    if (!location) return 99999;

    const R = 6371;
    const dLat = ((zone.lat - location.latitude) * Math.PI) / 180;
    const dLon = ((zone.lng - location.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((location.latitude * Math.PI) / 180) *
        Math.cos((zone.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return Math.round(
      R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000
    );
  };

  const getETA = (d) => Math.max(1, Math.round(d / 80));

  const isEvent = () => {
    if (!location) return false;
    return (
      getDistance({ lat: EVENT.lat, lng: EVENT.lng }) <= EVENT.radius
    );
  };

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
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${gate.lat},${gate.lng}`
    );
  };

  const getCrowdColor = (c) => {
    if (c > 70) return "#ef4444";
    if (c < 30) return "#22c55e";
    return "#f59e0b";
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
  if (!isEvent()) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>🚫 No Event Nearby</Text>
        <Text style={styles.emptySub}>
          Move closer to explore gates
        </Text>
      </View>
    );
  }

  // ================= UI =================
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ListHeaderComponent={
          <>
            {/* 🔥 HERO CARD */}
            {bestGate && (
              <View style={styles.hero}>
                <Text style={styles.heroTitle}>
                  🎯 Best Gate: {bestGate.name}
                </Text>
                <Text style={styles.heroSub}>
                  Crowd: {bestGate.crowdLevel}% • ETA:{" "}
                  {getETA(getDistance(bestGate))} min
                </Text>
              </View>
            )}

            {/* 🗺 MAP */}
            <View style={styles.mapWrapper}>
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
            </View>
          </>
        }
        data={zones}
        keyExtractor={(item, i) => `gate-${i}`}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          const dist = getDistance(item);
          const eta = getETA(dist);
          const isBest = bestGate?.name === item.name;

          return (
            <View style={[styles.card, isBest && styles.bestCard]}>
              <View style={styles.row}>
                <Text style={styles.title}>{item.name}</Text>

                <View
                  style={[
                    styles.badge,
                    { backgroundColor: getCrowdColor(item.crowdLevel) },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.crowdLevel}%
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>
                📏 {dist} m • ⏱ {eta} min
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
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  hero: {
    backgroundColor: "#3b82f6",
    margin: 15,
    padding: 18,
    borderRadius: 18,
  },

  heroTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },

  heroSub: {
    color: "#e0f2fe",
    marginTop: 5,
  },

  mapWrapper: {
    marginHorizontal: 15,
    borderRadius: 18,
    overflow: "hidden",
  },

  map: {
    height: 200,
  },

  card: {
    backgroundColor: "white",
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    elevation: 3,
  },

  bestCard: {
    borderWidth: 2,
    borderColor: "#3b82f6",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1e293b",
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  badgeText: {
    color: "white",
    fontWeight: "bold",
  },

  meta: {
    marginTop: 6,
    color: "#64748b",
  },

  navBtn: {
    marginTop: 12,
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  navText: {
    color: "white",
    fontWeight: "bold",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ef4444",
  },

  emptySub: {
    color: "#64748b",
    marginTop: 10,
  },
});