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

  // ==============================
  // FETCH PROFILE
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
      });

      setUser(res?.data?.user || null);
    } catch (error) {
      console.log("Profile Error:", error);

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

  // ==============================
  // REFRESH
  // ==============================
  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  // ==============================
  // LOGOUT
  // ==============================
  const logout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout from SmartVenue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("token");
              router.replace("/login");
            } catch (error) {
              console.log("Logout Error:", error);
            }
          },
        },
      ]
    );
  };

  // ==============================
  // INITIAL LOADING
  // ==============================
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Text style={styles.loadingIconText}>S</Text>
        </View>

        <ActivityIndicator
          size="large"
          color="#2563eb"
          style={{ marginTop: 20 }}
        />

        <Text style={styles.loadingTitle}>
          Loading your profile
        </Text>

        <Text style={styles.loadingSubtitle}>
          Please wait...
        </Text>
      </SafeAreaView>
    );
  }

  // ==============================
  // ERROR
  // ==============================
  if (!user) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>!</Text>
        </View>

        <Text style={styles.errorTitle}>
          Unable to load profile
        </Text>

        <Text style={styles.errorSubtitle}>
          Please check your connection and try again.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchProfile}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const firstLetter =
    user?.name?.charAt?.(0)?.toUpperCase() || "U";

  return (
    <SafeAreaView style={styles.container}>
      {/* =================================
          BLUE HEADER BACKGROUND
      ================================= */}
      <View style={styles.headerBackground}>
        <View style={styles.headerCircleOne} />
        <View style={styles.headerCircleTwo} />

        <View
          style={[
            styles.headerContent,
            { paddingTop: insets.top + 12 },
          ]}
        >
          <View>
            <Text style={styles.smallHeaderText}>
              SMARTVENUE
            </Text>

            <Text style={styles.headerTitle}>
              My Profile
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onRefresh}
          >
            <Text style={styles.headerIcon}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 110,
        }}
      >
        {/* =================================
            PROFILE CARD
        ================================= */}
        <View style={styles.profileCard}>
          {/* AVATAR */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {firstLetter}
              </Text>
            </View>

            {/* ONLINE DOT */}
            <View style={styles.onlineDot} />
          </View>

          {/* NAME */}
          <Text style={styles.name}>
            {user.name}
          </Text>

          {/* EMAIL */}
          <Text style={styles.email}>
            {user.email}
          </Text>

          {/* ROLE BADGE */}
          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />

            <Text style={styles.roleText}>
              {user.role === "admin"
                ? "Administrator"
                : "SmartVenue User"}
            </Text>
          </View>

          {/* EDIT PROFILE */}
          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.8}
            onPress={() => router.push("/edit-profile")}
          >
            <Text style={styles.editIcon}>✎</Text>

            <Text style={styles.editButtonText}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* =================================
            ACTIVITY SUMMARY
        ================================= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Activity
          </Text>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: "#eff6ff" },
                ]}
              >
                <Text>🎪</Text>
              </View>

              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>
                Events
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: "#ecfdf5" },
                ]}
              >
                <Text>📍</Text>
              </View>

              <Text style={styles.statNumber}>5</Text>
              <Text style={styles.statLabel}>
                Visits
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: "#fffbeb" },
                ]}
              >
                <Text>⭐</Text>
              </View>

              <Text style={styles.statNumber}>
                4.8
              </Text>

              <Text style={styles.statLabel}>
                Rating
              </Text>
            </View>
          </View>
        </View>

        {/* =================================
            SMARTVENUE FEATURES
        ================================= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            SmartVenue
          </Text>

          <View style={styles.menuCard}>
            {/* LIVE NAVIGATION */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push("/explore")}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "#eff6ff" },
                ]}
              >
                <Text style={styles.menuEmoji}>🗺️</Text>
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>
                  Smart Navigation
                </Text>

                <Text style={styles.menuSubtitle}>
                  Find the best gate with live crowd data
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* ALERTS */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push("/alerts")}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "#fff7ed" },
                ]}
              >
                <Text style={styles.menuEmoji}>🔔</Text>
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>
                  Live Alerts
                </Text>

                <Text style={styles.menuSubtitle}>
                  Get real-time crowd notifications
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* EVENT ACTIVITY */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "#f0fdf4" },
                ]}
              >
                <Text style={styles.menuEmoji}>📊</Text>
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>
                  My Activity
                </Text>

                <Text style={styles.menuSubtitle}>
                  View your SmartVenue activity
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =================================
            ACCOUNT
        ================================= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Account
          </Text>

          <View style={styles.menuCard}>
            {/* EDIT PROFILE */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/edit-profile")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "#f8fafc" },
                ]}
              >
                <Text style={styles.menuEmoji}>👤</Text>
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>
                  Personal Information
                </Text>

                <Text style={styles.menuSubtitle}>
                  Update your name and email
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* SECURITY */}
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "#fef2f2" },
                ]}
              >
                <Text style={styles.menuEmoji}>🔐</Text>
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>
                  Security
                </Text>

                <Text style={styles.menuSubtitle}>
                  Manage your account security
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =================================
            LOGOUT
        ================================= */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={logout}
        >
          <View style={styles.logoutIcon}>
            <Text>↪</Text>
          </View>

          <Text style={styles.logoutText}>
            Logout
          </Text>
        </TouchableOpacity>

        {/* VERSION */}
        <Text style={styles.version}>
          SmartVenue • Smart Crowd Navigation
        </Text>

        <Text style={styles.versionNumber}>
          Version 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  // ================= HEADER =================

  headerBackground: {
    height: 185,
    backgroundColor: "#2563eb",
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: "hidden",
  },

  headerCircleOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
    right: -50,
    top: -60,
  },

  headerCircleTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)",
    left: -45,
    top: 80,
  },

  headerContent: {
    paddingHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  smallHeaderText: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },

  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  headerIcon: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "300",
  },

  // ================= PROFILE =================

  profileCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 18,
    marginTop: -45,
    borderRadius: 25,
    padding: 22,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 15,

    elevation: 7,
  },

  avatarWrapper: {
    position: "relative",
    marginTop: -70,
    marginBottom: 12,
  },

  avatar: {
    width: 105,
    height: 105,
    borderRadius: 55,
    backgroundColor: "#2563eb",
    borderWidth: 5,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "800",
  },

  onlineDot: {
    position: "absolute",
    right: 4,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    borderWidth: 4,
    borderColor: "#ffffff",
  },

  name: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },

  email: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 5,
    textAlign: "center",
  },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 12,
  },

  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 5,
    backgroundColor: "#2563eb",
    marginRight: 7,
  },

  roleText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },

  editButton: {
    width: "100%",
    marginTop: 18,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  editIcon: {
    color: "#ffffff",
    fontSize: 18,
    marginRight: 8,
  },

  editButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  // ================= SECTIONS =================

  section: {
    width: "100%",
    paddingHorizontal: 18,
    marginTop: 25,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 11,
  },

  // ================= STATS =================

  statsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 7,
  },

  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },

  statLabel: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 55,
    backgroundColor: "#e2e8f0",
  },

  // ================= MENU =================

  menuCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
  },

  menuIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  menuEmoji: {
    fontSize: 20,
  },

  menuContent: {
    flex: 1,
    marginLeft: 13,
    paddingRight: 8,
  },

  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },

  menuSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
    lineHeight: 16,
  },

  arrow: {
    fontSize: 27,
    color: "#94a3b8",
    fontWeight: "300",
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 73,
  },

  // ================= LOGOUT =================

  logoutButton: {
    marginHorizontal: 18,
    marginTop: 25,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fee2e2",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  logoutIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 9,
  },

  logoutText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "700",
  },

  // ================= FOOTER =================

  version: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 24,
  },

  versionNumber: {
    textAlign: "center",
    color: "#cbd5e1",
    fontSize: 10,
    marginTop: 4,
  },

  // ================= LOADING =================

  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingIconText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
  },

  loadingTitle: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },

  loadingSubtitle: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 13,
  },

  // ================= ERROR =================

  errorContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  errorIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
  },

  errorIconText: {
    color: "#ef4444",
    fontSize: 30,
    fontWeight: "800",
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 15,
  },

  errorSubtitle: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 7,
    lineHeight: 20,
  },

  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 13,
    marginTop: 20,
  },

  retryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});