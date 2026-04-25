import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
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

  const router = useRouter();

  // ================= LOAD USER =================
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const token = await AsyncStorage.getItem("token");

    const res = await axios.get(`${API_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    setName(res.data.user.name);
    setEmail(res.data.user.email);
    setImage(res.data.user.avatar);
  };

  // ================= PICK IMAGE =================
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // ================= SAVE =================
  const saveProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      await axios.put(
        `${API_URL}/user/update`,
        { name, email, avatar: image },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert("Success", "Profile updated!");
      router.back();
    } catch (err) {
      Alert.alert("Error", "Update failed");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      {/* IMAGE */}
      <TouchableOpacity onPress={pickImage}>
        <Image
          source={{
            uri:
              image ||
              "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          }}
          style={styles.avatar}
        />
      </TouchableOpacity>

      {/* INPUTS */}
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor="#94a3b8"
      />

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#94a3b8"
      />

      {/* SAVE */}
      <TouchableOpacity style={styles.btn} onPress={saveProfile}>
        <Text style={styles.btnText}>Save Changes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", padding: 20 },
  title: { color: "white", fontSize: 24, marginBottom: 20 },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
    marginBottom: 20,
  },

  input: {
    backgroundColor: "#1e293b",
    color: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },

  btn: {
    backgroundColor: "#22c55e",
    padding: 15,
    borderRadius: 12,
  },

  btnText: { color: "white", textAlign: "center" },
});