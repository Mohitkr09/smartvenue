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
  StatusBar,
} from "react-native";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const API_URL = "https://smartvenue.online";

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // =========================
  // PASSWORD STRENGTH
  // =========================
  const getPasswordStrength = () => {
    if (!password) {
      return {
        label: "",
        width: "0%",
      };
    }

    if (password.length < 6) {
      return {
        label: "Weak",
        width: "25%",
      };
    }

    if (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password)
    ) {
      return {
        label: "Strong",
        width: "100%",
      };
    }

    return {
      label: "Medium",
      width: "60%",
    };
  };

  const passwordStrength = getPasswordStrength();

  // =========================
  // REGISTER
  // =========================
  const register = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      Alert.alert(
        "Missing Information",
        "Please fill in all the fields."
      );
      return;
    }

    if (cleanName.length < 2) {
      Alert.alert(
        "Invalid Name",
        "Name must contain at least 2 characters."
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      Alert.alert(
        "Invalid Email",
        "Please enter a valid email address."
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Weak Password",
        "Password must contain at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);

      await axios.post(`${API_URL}/auth/register`, {
        name: cleanName,
        email: cleanEmail,
        password,
      });

      Alert.alert(
        "Account Created 🎉",
        "Your SmartVenue account has been created successfully.",
        [
          {
            text: "Continue",
            onPress: () => router.replace("/login"),
          },
        ]
      );
    } catch (err: any) {
      console.log(
        "Register Error:",
        err?.response?.data || err?.message
      );

      Alert.alert(
        "Registration Failed",
        err?.response?.data?.message ||
          "Unable to create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#2563eb"
      />

      {/* ================= TOP BLUE SECTION ================= */}
      <View style={styles.topBackground}>
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

          <Text style={styles.brandName}>SmartVenue</Text>

          <Text style={styles.brandTagline}>
            Navigate smarter. Move safer.
          </Text>
        </View>
      </View>

      {/* ================= FORM ================= */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* HEADER */}
            <View style={styles.header}>
              <Text style={styles.title}>
                Create Account
              </Text>

              <Text style={styles.subtitle}>
                Join SmartVenue and experience smarter
                crowd navigation.
              </Text>
            </View>

            {/* ================= NAME ================= */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#64748b"
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Full Name"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* ================= EMAIL ================= */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#64748b"
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Email Address"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* ================= PASSWORD ================= */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#64748b"
                style={styles.inputIcon}
              />

              <TextInput
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowPassword(!showPassword)
                }
                style={styles.eyeButton}
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-outline"
                      : "eye-off-outline"
                  }
                  size={21}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            {/* ================= PASSWORD STRENGTH ================= */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        width:
                          passwordStrength.width as any,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.strengthText}>
                  Password: {passwordStrength.label}
                </Text>
              </View>
            )}

            {/* ================= PASSWORD REQUIREMENTS ================= */}
            <View style={styles.requirements}>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    password.length >= 6
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={16}
                  color={
                    password.length >= 6
                      ? "#22c55e"
                      : "#94a3b8"
                  }
                />

                <Text style={styles.requirementText}>
                  At least 6 characters
                </Text>
              </View>

              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    /[0-9]/.test(password)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={16}
                  color={
                    /[0-9]/.test(password)
                      ? "#22c55e"
                      : "#94a3b8"
                  }
                />

                <Text style={styles.requirementText}>
                  Include a number
                </Text>
              </View>
            </View>

            {/* ================= REGISTER BUTTON ================= */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.button,
                loading && styles.buttonDisabled,
              ]}
              onPress={register}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    Create Account
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#ffffff"
                  />
                </>
              )}
            </TouchableOpacity>

            {/* ================= TERMS ================= */}
            <Text style={styles.terms}>
              By creating an account, you agree to our{" "}
              <Text style={styles.termsLink}>
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text style={styles.termsLink}>
                Privacy Policy
              </Text>
              .
            </Text>

            {/* ================= DIVIDER ================= */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />

              <Text style={styles.orText}>OR</Text>

              <View style={styles.divider} />
            </View>

            {/* ================= LOGIN ================= */}
            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.7}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginBold}>
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* SECURITY NOTE */}
          <View style={styles.securityContainer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color="#64748b"
            />

            <Text style={styles.securityText}>
              Your account information is securely protected.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  // ================= TOP =================

  topBackground: {
    height: 265,
    backgroundColor: "#2563eb",
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    overflow: "hidden",
    position: "relative",
  },

  circleOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -70,
    right: -45,
  },

  circleTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -45,
    left: -35,
  },

  brandContainer: {
    alignItems: "center",
    paddingTop: 55,
  },

  brandIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  brandName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  brandTagline: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 5,
  },

  // ================= KEYBOARD =================

  keyboardView: {
    flex: 1,
    marginTop: -50,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 35,
  },

  // ================= CARD =================

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 22,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,

    elevation: 8,
  },

  header: {
    alignItems: "center",
    marginBottom: 22,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 7,
  },

  subtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  // ================= INPUT =================

  inputWrapper: {
    width: "100%",
    height: 54,
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#f8fafc",

    borderWidth: 1,
    borderColor: "#e2e8f0",

    borderRadius: 15,

    marginBottom: 12,

    paddingHorizontal: 14,
  },

  inputIcon: {
    marginRight: 11,
  },

  input: {
    flex: 1,
    height: "100%",
    color: "#0f172a",
    fontSize: 15,
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    color: "#0f172a",
    fontSize: 15,
  },

  eyeButton: {
    padding: 5,
    marginLeft: 5,
  },

  // ================= PASSWORD =================

  passwordStrengthContainer: {
    width: "100%",
    marginTop: -3,
    marginBottom: 10,
  },

  strengthTrack: {
    height: 4,
    width: "100%",
    backgroundColor: "#e2e8f0",
    borderRadius: 5,
    overflow: "hidden",
  },

  strengthBar: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 5,
  },

  strengthText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 5,
  },

  requirements: {
    width: "100%",
    marginBottom: 7,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  requirementText: {
    fontSize: 11,
    color: "#64748b",
    marginLeft: 6,
  },

  // ================= BUTTON =================

  button: {
    width: "100%",
    height: 54,

    backgroundColor: "#2563eb",

    borderRadius: 15,

    marginTop: 12,

    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#2563eb",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,

    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 9,
  },

  // ================= TERMS =================

  terms: {
    fontSize: 10.5,
    lineHeight: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 13,
    paddingHorizontal: 8,
  },

  termsLink: {
    color: "#2563eb",
    fontWeight: "600",
  },

  // ================= DIVIDER =================

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 18,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },

  orText: {
    fontSize: 10,
    color: "#94a3b8",
    marginHorizontal: 10,
    fontWeight: "600",
  },

  // ================= LOGIN =================

  loginButton: {
    alignItems: "center",
    paddingVertical: 4,
  },

  loginText: {
    color: "#64748b",
    fontSize: 13,
  },

  loginBold: {
    color: "#2563eb",
    fontWeight: "800",
  },

  // ================= SECURITY =================

  securityContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 10,
  },

  securityText: {
    color: "#64748b",
    fontSize: 11,
    marginLeft: 6,
  },
});