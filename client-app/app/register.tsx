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
import { useRouter } from "expo-router";

// ==============================
// 🌐 API CONFIG (FINAL)
// ==============================
const API_URL = "https://smartvenue.online"; // ✅ ONLY HTTPS

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ==============================
  // 📝 REGISTER FUNCTION
  // ==============================
  const register = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return Alert.alert("Error", "All fields are required");
    }

    if (!email.includes("@")) {
      return Alert.alert("Error", "Invalid email address");
    }

    if (password.length < 6) {
      return Alert.alert("Error", "Password must be at least 6 characters");
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_URL}/auth/register`,
        {
          name,
          email,
          password,
        },
        {
          timeout: 10000,
        }
      );

      Alert.alert("Success", "Account created successfully!");

      router.replace("/login");
    } catch (err: any) {
      console.log("❌ Register Error:", err?.message);

      if (err.response?.data?.msg) {
        Alert.alert("Error", err.response.data.msg);
      } else if (err.code === "ECONNABORTED") {
        Alert.alert("Error", "Request timeout. Try again.");
      } else {
        Alert.alert("Error", "Registration failed. Try again.");
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
      <Text style={styles.title}>Create Account 🚀</Text>

      {/* NAME */}
      <TextInput
        placeholder="Full Name"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      {/* EMAIL */}
      <TextInput
        placeholder="Email"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      {/* PASSWORD */}
      <TextInput
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {/* BUTTON */}
      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={register}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>

      {/* LOGIN LINK */}
      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={styles.link}>
          Already have an account? Login
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