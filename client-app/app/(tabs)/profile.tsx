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

  // ================= UI =================
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 90 }, // 🔥 fix tab overlap
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user?.name?.charAt?.(0) || "U").toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{user?.name}</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>

        {/* INFO CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Info</Text>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Full Name</Text>
            <Text style={styles.value}>{user?.name}</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
        </View>

        {/* ACTION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Actions</Text>

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
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  header: {
    alignItems: "center",
    marginBottom: 25,
  },

  avatarWrapper: {
    shadowColor: "#3b82f6",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },

  avatarCircle: {
    width: 130,
    height: 130,
    borderRadius: 100,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "white",
    fontSize: 44,
    fontWeight: "bold",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 10,
  },

  subtitle: {
    color: "#64748b",
    marginTop: 4,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1e293b",
  },

  infoBox: {
    marginBottom: 10,
  },

  label: {
    color: "#64748b",
    fontSize: 12,
  },

  value: {
    color: "#1e293b",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2,
  },

  logoutBtn: {
    backgroundColor: "#ef4444",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
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
    backgroundColor: "#f1f5f9",
  },

  loadingText: {
    color: "#64748b",
    marginTop: 10,
  },
});