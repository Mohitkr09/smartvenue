import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const API_URL = "https://smartvenue.online";

export default function EditProfile() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const router = useRouter();

  // ================= LOAD USER =================
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setName(res?.data?.user?.name || "");
      setEmail(res?.data?.user?.email || "");
      setImage(res?.data?.user?.avatar || null);
    } catch {
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setInitialLoading(false);
    }
  };

  // ================= PICK IMAGE =================
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      return Alert.alert("Permission required", "Allow gallery access");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // ================= SAVE =================
  const saveProfile = async () => {
    if (!name || !email) {
      return Alert.alert("Error", "All fields required");
    }

    if (!email.includes("@")) {
      return Alert.alert("Error", "Invalid email");
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      await axios.put(
        `${API_URL}/user/profile`,
        { name, email, avatar: image },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert("Success", "Profile updated!");
      router.back();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Update failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // ================= LOADING =================
  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: "#94a3b8", marginTop: 10 }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  // ================= UI =================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.title}>Edit Profile</Text>

        {/* AVATAR */}
        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
          <Image
            source={{
              uri:
                image ||
                "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            style={styles.avatar}
          />

          <View style={styles.editBadge}>
            <Text style={{ color: "white", fontSize: 12 }}>✏️</Text>
          </View>
        </TouchableOpacity>

        {/* FORM */}
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full Name"
            placeholderTextColor="#94a3b8"
          />

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* BUTTON */}
        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={saveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },

  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
  },

  avatarWrapper: {
    alignSelf: "center",
    marginBottom: 25,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#3b82f6",
  },

  editBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#3b82f6",
    padding: 6,
    borderRadius: 12,
  },

  card: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
  },

  input: {
    backgroundColor: "#020617",
    color: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },

  btn: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  btnText: {
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
});