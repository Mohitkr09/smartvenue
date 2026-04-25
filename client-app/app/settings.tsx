import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(true);
  const router = useRouter();

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* DARK MODE */}
      <View style={styles.row}>
        <Text style={styles.text}>Dark Mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>

      {/* EDIT PROFILE */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push("/edit-profile")}
      >
        <Text style={styles.text}>Edit Profile</Text>
      </TouchableOpacity>

      {/* LOGOUT */}
      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={{ color: "white" }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", padding: 20 },
  title: { color: "white", fontSize: 24, marginBottom: 20 },

  row: {
    backgroundColor: "#1e293b",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  text: { color: "white" },

  logout: {
    backgroundColor: "#ef4444",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
  },
});