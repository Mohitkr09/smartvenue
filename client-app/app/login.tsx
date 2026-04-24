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
} from "react-native";
import { useState } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// ==============================
// 🌐 API CONFIG (FINAL)
// ==============================
const API_URL = "https://smartvenue.online"; // ✅ ONLY HTTPS

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // ==============================
  // 🔐 LOGIN FUNCTION
  // ==============================
  const login = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert("Error", "Please fill all fields");
    }

    if (!email.includes("@")) {
      return Alert.alert("Error", "Invalid email address");
    }

    try {
      setLoading(true);

      const res = await axios.post(
        `${API_URL}/auth/login`,
        {
          email,
          password,
        },
        {
          timeout: 10000,
        }
      );

      const token = res?.data?.token;

      if (!token) {
        throw new Error("No token received");
      }

      await AsyncStorage.setItem("token", token);

      Alert.alert("Success", "Logged in successfully!");

      router.replace("/");
    } catch (err: any) {
      console.log("❌ Login Error:", err?.message);

      if (err.response?.data?.msg) {
        Alert.alert("Error", err.response.data.msg);
      } else if (err.code === "ECONNABORTED") {
        Alert.alert("Error", "Request timeout. Try again.");
      } else {
        Alert.alert("Error", "Login failed. Check connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // UI
  // ==============================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* TITLE */}
      <Text style={styles.title}>Welcome Back 👋</Text>

      {/* EMAIL */}
      <TextInput
        placeholder="Email"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {/* PASSWORD */}
      <TextInput
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* LOGIN BUTTON */}
      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={login}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      {/* REGISTER LINK */}
      <TouchableOpacity onPress={() => router.replace("/register")}>
        <Text style={styles.link}>
          Don't have an account? Register
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// ==============================
// 🎨 STYLES
// ==============================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    padding: 20,
  },

  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
  },

  input: {
    backgroundColor: "#1e293b",
    color: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },

  button: {
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },

  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },

  link: {
    color: "#38bdf8",
    textAlign: "center",
    marginTop: 18,
    fontSize: 14,
  },
});