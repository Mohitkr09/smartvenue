import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
  SafeAreaView,
} from "react-native";
import { useEffect, useState } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_URL = "https://smartvenue.online";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUser(res?.data?.user || null);
    } catch {
      await AsyncStorage.removeItem("token");
      router.replace("/login");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const logout = async () => {
    Alert.alert("Logout", "Do you really want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("token");
          router.replace("/login");
        },
      },
    ]);
  };

  // ================= LOADING =================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#ef4444" }}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔵 TOP BACKGROUND (LIKE LOGIN) */}
      <View style={styles.backgroundTop} />

      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 🤍 MAIN CARD */}
        <View style={styles.card}>
          {/* AVATAR */}
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>
              {(user?.name?.charAt?.(0) || "U").toUpperCase()}
            </Text>
          </View>

          {/* TITLE */}
          <Text style={styles.title}>{user.name}</Text>
          <Text style={styles.subtitle}>{user.email}</Text>

          {/* STATS */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>⭐ 4.8</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {/* BUTTONS */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/edit-profile")}
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  backgroundTop: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: "40%",
    backgroundColor: "#3b82f6",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  card: {
    width: "85%",
    marginTop: 90,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },

  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 60,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  logoText: {
    color: "white",
    fontSize: 40,
    fontWeight: "bold",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
  },

  subtitle: {
    color: "#64748b",
    marginBottom: 20,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },

  statBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    width: "30%",
  },

  statValue: {
    fontWeight: "bold",
    fontSize: 16,
  },

  statLabel: {
    color: "#64748b",
    fontSize: 12,
  },

  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },

  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },

  logoutBtn: {
    width: "100%",
    backgroundColor: "#ef4444",
    padding: 14,
    borderRadius: 14,
  },

  logoutText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#64748b",
  },
});