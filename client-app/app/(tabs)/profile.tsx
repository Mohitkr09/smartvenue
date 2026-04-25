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

const API_URL = "https://smartvenue.online";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  // ================= FETCH PROFILE =================
  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      setUser(res?.data?.user || null);
    } catch (err: any) {
      console.log("❌ Profile Error:", err?.message);
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

  // ================= LOGOUT =================
  const logout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
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
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ================= ERROR =================
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#ef4444" }}>
          Failed to load profile
        </Text>
      </View>
    );
  }

  // ================= UI =================
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* AVATAR */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name?.charAt?.(0) || "U").toUpperCase()}
          </Text>
        </View>
      </View>

      {/* USER CARD */}
      <View style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <Text style={styles.value}>{user?.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>

      {/* ACTIONS */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },

  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: "center",
  },

  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
  },

  avatarWrapper: {
    alignItems: "center",
    marginTop: -30,
    marginBottom: 20,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 60,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",

    // glow effect
    shadowColor: "#22c55e",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },

  avatarText: {
    color: "white",
    fontSize: 36,
    fontWeight: "bold",
  },

  card: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 20,

    backgroundColor: "rgba(255,255,255,0.05)", // glassmorphism
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  label: {
    color: "#94a3b8",
    marginTop: 10,
    fontSize: 13,
  },

  value: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },

  logoutBtn: {
    margin: 20,
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 14,
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
    backgroundColor: "#020617",
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 10,
  },
});