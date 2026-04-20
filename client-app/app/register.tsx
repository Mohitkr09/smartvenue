import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "expo-router";

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (!name || !email || !password) {
      return Alert.alert("Error", "All fields are required");
    }

    if (password.length < 6) {
      return Alert.alert("Error", "Password must be at least 6 characters");
    }

    try {
      setLoading(true);

      await axios.post("http://172.20.39.19:5000/auth/register", {
        name,
        email,
        password,
      });

      Alert.alert("Success", "Account created successfully!");

      router.replace("/login"); // 🔥 redirect to login
    } catch (err) {
      if (err.response?.data?.msg) {
        Alert.alert("Error", err.response.data.msg);
      } else {
        Alert.alert("Error", "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* TITLE */}
      <Text style={styles.title}>Create Account</Text>

      {/* INPUTS */}
      <TextInput
        placeholder="Full Name"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        style={styles.input}
        onChangeText={setPassword}
      />

      {/* REGISTER BUTTON */}
      <TouchableOpacity
        style={styles.button}
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
    </View>
  );
}

// 🎨 STYLES
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