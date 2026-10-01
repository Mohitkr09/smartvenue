import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from "react-native";
import { useState } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const API_URL = "https://smartvenue.online";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // ==========================================
  // LOGIN
  // ==========================================

  const login = async () => {
    Keyboard.dismiss();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter your email and password."
      );
      return;
    }

    if (!cleanEmail.includes("@")) {
      Alert.alert(
        "Invalid Email",
        "Please enter a valid email address."
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Invalid Password",
        "Password must contain at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_URL}/auth/login`, {
        email: cleanEmail,
        password,
      });

      const token = res?.data?.token;

      if (!token) {
        throw new Error("Authentication token not received");
      }

      // Store JWT
      await AsyncStorage.setItem("token", token);

      // Optional: store basic user information
      if (res?.data?.user) {
        await AsyncStorage.setItem(
          "user",
          JSON.stringify(res.data.user)
        );
      }

      router.replace("/");
    } catch (err: any) {
      console.log(
        "Login Error:",
        err?.response?.data || err?.message
      );

      const message =
        err?.response?.data?.message ||
        "Unable to login. Please check your credentials.";

      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : "height"
      }
    >
      {/* ==========================================
          BACKGROUND
      ========================================== */}

      <View style={styles.backgroundTop}>
        <View style={styles.circleOne} />
        <View style={styles.circleTwo} />

        <View style={styles.brandContainer}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="navigate"
              size={30}
              color="#ffffff"
            />
          </View>

          <Text style={styles.brandName}>
            SmartVenue
          </Text>

          <Text style={styles.brandTagline}>
            Smart Crowd Navigation
          </Text>
        </View>
      </View>

      {/* ==========================================
          CONTENT
      ========================================== */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          {/* ======================================
              HEADER
          ====================================== */}

          <View style={styles.welcomeContainer}>
            <Text style={styles.title}>
              Welcome Back
            </Text>

            <Text style={styles.wave}>
              👋
            </Text>
          </View>

          <Text style={styles.subtitle}>
            Sign in to continue exploring SmartVenue
          </Text>

          {/* ======================================
              EMAIL
          ====================================== */}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Email Address
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#64748b"
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* ======================================
              PASSWORD
          ====================================== */}

          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>
                Password
              </Text>

              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "Password Reset",
                    "Password reset functionality can be added here."
                  );
                }}
              >
                <Text style={styles.forgotText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#64748b"
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={login}
              />

              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() =>
                  setShowPassword((prev) => !prev)
                }
                disabled={loading}
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-outline"
                      : "eye-off-outline"
                  }
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ======================================
              LOGIN BUTTON
          ====================================== */}

          <TouchableOpacity
            style={[
              styles.loginButton,
              loading && styles.loginButtonDisabled,
            ]}
            onPress={login}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <>
                <ActivityIndicator
                  color="#ffffff"
                  size="small"
                />

                <Text style={styles.loginButtonText}>
                  Signing in...
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.loginButtonText}>
                  Sign In
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#ffffff"
                />
              </>
            )}
          </TouchableOpacity>

          {/* ======================================
              SECURITY NOTE
          ====================================== */}

          <View style={styles.securityRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color="#22c55e"
            />

            <Text style={styles.securityText}>
              Your account is securely protected
            </Text>
          </View>

          {/* ======================================
              DIVIDER
          ====================================== */}

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />

            <Text style={styles.dividerText}>
              OR
            </Text>

            <View style={styles.divider} />
          </View>

          {/* ======================================
              REGISTER
          ====================================== */}

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.replace("/register")}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.registerText}>
              Don't have an account?{" "}
            </Text>

            <Text style={styles.registerBold}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* ==========================================
            FOOTER
        ========================================== */}

        <Text style={styles.footerText}>
          SmartVenue • Smart Crowd Navigation
        </Text>

        <Text style={styles.versionText}>
          Version 1.0.0
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  // ==========================================
  // CONTAINER
  // ==========================================

  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 145,
    paddingBottom: 30,
  },

  // ==========================================
  // BLUE HEADER
  // ==========================================

  backgroundTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,

    height: 300,

    backgroundColor: "#2563eb",

    borderBottomLeftRadius: 55,
    borderBottomRightRadius: 55,

    overflow: "hidden",
  },

  circleOne: {
    position: "absolute",

    width: 190,
    height: 190,

    borderRadius: 100,

    backgroundColor: "rgba(255,255,255,0.08)",

    right: -55,
    top: -65,
  },

  circleTwo: {
    position: "absolute",

    width: 130,
    height: 130,

    borderRadius: 100,

    backgroundColor: "rgba(255,255,255,0.06)",

    left: -50,
    bottom: 15,
  },

  // ==========================================
  // BRAND
  // ==========================================

  brandContainer: {
    alignItems: "center",
    marginTop: 38,
  },

  brandIcon: {
    width: 62,
    height: 62,

    borderRadius: 20,

    backgroundColor: "rgba(255,255,255,0.18)",

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 10,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  brandName: {
    color: "#ffffff",

    fontSize: 27,
    fontWeight: "800",

    letterSpacing: 0.3,
  },

  brandTagline: {
    color: "#dbeafe",

    fontSize: 12,
    fontWeight: "500",

    marginTop: 3,
  },

  // ==========================================
  // CARD
  // ==========================================

  card: {
    width: "88%",

    backgroundColor: "#ffffff",

    borderRadius: 27,

    paddingHorizontal: 21,
    paddingVertical: 25,

    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,

    elevation: 10,
  },

  // ==========================================
  // TITLE
  // ==========================================

  welcomeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0f172a",
  },

  wave: {
    fontSize: 23,
    marginLeft: 7,
  },

  subtitle: {
    textAlign: "center",

    color: "#64748b",

    fontSize: 13,

    lineHeight: 19,

    marginTop: 6,
    marginBottom: 24,
  },

  // ==========================================
  // INPUT
  // ==========================================

  inputGroup: {
    width: "100%",
    marginBottom: 17,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",

    marginBottom: 7,
  },

  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  forgotText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },

  inputWrapper: {
    width: "100%",
    height: 54,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#f8fafc",

    borderWidth: 1,
    borderColor: "#e2e8f0",

    borderRadius: 15,
  },

  inputIcon: {
    marginLeft: 15,
  },

  input: {
    flex: 1,

    height: "100%",

    paddingHorizontal: 11,

    color: "#0f172a",

    fontSize: 14,
  },

  eyeButton: {
    width: 48,
    height: "100%",

    justifyContent: "center",
    alignItems: "center",
  },

  // ==========================================
  // LOGIN BUTTON
  // ==========================================

  loginButton: {
    width: "100%",
    height: 54,

    borderRadius: 15,

    backgroundColor: "#2563eb",

    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",

    marginTop: 4,

    shadowColor: "#2563eb",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,

    elevation: 5,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",

    marginRight: 9,
  },

  // ==========================================
  // SECURITY
  // ==========================================

  securityRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",

    marginTop: 15,
  },

  securityText: {
    color: "#64748b",

    fontSize: 11,

    marginLeft: 5,
  },

  // ==========================================
  // DIVIDER
  // ==========================================

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",

    width: "100%",

    marginVertical: 20,
  },

  divider: {
    flex: 1,

    height: 1,

    backgroundColor: "#e2e8f0",
  },

  dividerText: {
    color: "#94a3b8",

    fontSize: 10,
    fontWeight: "700",

    marginHorizontal: 12,
  },

  // ==========================================
  // REGISTER
  // ==========================================

  registerButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",

    paddingVertical: 4,
  },

  registerText: {
    color: "#64748b",

    fontSize: 13,
  },

  registerBold: {
    color: "#2563eb",

    fontSize: 13,

    fontWeight: "800",
  },

  // ==========================================
  // FOOTER
  // ==========================================

  footerText: {
    color: "#94a3b8",

    fontSize: 10,

    marginTop: 20,
  },

  versionText: {
    color: "#cbd5e1",

    fontSize: 9,

    marginTop: 4,
  },
});