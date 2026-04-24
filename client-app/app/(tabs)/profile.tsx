import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from "react-native";
import { useEffect, useState } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// ==============================
// 🌐 API CONFIG (FINAL)
// ==============================
const API_URL = "https://smartvenue.online"; // ✅ ALWAYS HTTPS

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  // ==============================
  // 📡 FETCH PROFILE
  // ==============================
  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      setUser(res?.data?.user || null);
    } catch (err: any) {
      console.log("❌ Profile Error:", err?.message);

      // logout on error
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

  // ==============================
  // 🚪 LOGOUT
  // ==============================
  const logout = async () => {
    Alert.alert("Logout", "Are you sure?", [
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

  // ==============================
  // ⏳ LOADING UI
  // ==============================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ==============================
  // ❌ ERROR UI
  // ==============================
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#ef4444" }}>
          Failed to load profile
        </Text>
      </View>
    );
  }

  // ==============================
  // UI
  // ==============================
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* HEADER */}
      <Text style={styles.title}>👤 Profile</Text>

      {/* AVATAR */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(user?.name?.charAt?.(0) || "U").toUpperCase()}
        </Text>
      </View>

      {/* USER INFO */}
      <View style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <Text style={styles.value}>{user?.name || "N/A"}</Text>

        <Text style={styles.label}>Email Address</Text>
        <Text style={styles.value}>{user?.email || "N/A"}</Text>
      </View>

      {/* ACTIONS */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ==============================
// 🎨 STYLES
// ==============================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 20,
    paddingTop: 50,
  },

  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 50,
    backgroundColor: "#22c55e",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  avatarText: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "#1e293b",
    padding: 20,
    borderRadius: 14,
    marginBottom: 20,
  },

  label: {
    color: "#94a3b8",
    marginTop: 10,
    fontSize: 13,
  },

  value: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },

  actions: {
    marginTop: 10,
  },

  logoutBtn: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  logoutText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 10,
  },
});