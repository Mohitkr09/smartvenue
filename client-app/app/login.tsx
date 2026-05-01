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
  Image,
} from "react-native";
import { useState } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const API_URL = "https://smartvenue.online";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const login = async () => {
    if (!email || !password) {
      return Alert.alert("Error", "Please fill all fields");
    }

    if (!email.includes("@")) {
      return Alert.alert("Error", "Enter a valid email");
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      await AsyncStorage.setItem("token", res.data.token);

      router.replace("/");
    } catch (err: any) {
      Alert.alert(
        "Login Failed",
        err?.response?.data?.message || "Invalid credentials"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* BACKGROUND */}
      <View style={styles.backgroundTop} />

      <View style={styles.card}>
        {/* LOGO */}
        <View style={styles.logoCircle}>
          <Image
            source={{
              uri: "https://cdn-icons-png.flaticon.com/512/1946/1946488.png",
            }}
            style={styles.logo}
          />
        </View>

        {/* TITLE */}
        <Text style={styles.title}>Welcome Back 👋</Text>
        <Text style={styles.subtitle}>
          Login to continue your journey
        </Text>

        {/* INPUTS */}
        <TextInput
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />

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
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={login}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        {/* LINK */}
        <TouchableOpacity onPress={() => router.replace("/register")}>
          <Text style={styles.link}>
            Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
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

  logo: {
    width: 55,
    height: 55,
    tintColor: "white",
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

  input: {
    width: "100%",
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    padding: 15,
    borderRadius: 14,
    marginTop: 10,
  },

  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },

  link: {
    marginTop: 15,
    color: "#64748b",
  },

  linkBold: {
    color: "#3b82f6",
    fontWeight: "bold",
  },
});