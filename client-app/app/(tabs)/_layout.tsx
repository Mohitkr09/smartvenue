import { Tabs } from "expo-router";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets(); // 🔥 IMPORTANT

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // 🎨 TAB BAR STYLE (FIXED)
        tabBarStyle: {
          backgroundColor: "#020617",
          borderTopWidth: 0,
          height: 65 + insets.bottom, // 🔥 ADAPTIVE HEIGHT
          paddingBottom: insets.bottom + 5, // 🔥 PUSH UP ICONS
          paddingTop: 5,
        },

        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#64748b",

        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 2,
        },

        tabBarItemStyle: {
          borderRadius: 10,
          marginHorizontal: 5,
        },
      }}
    >
      {/* 🏠 HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#1e293b" : "transparent",
                padding: 8,
                borderRadius: 10,
              }}
            >
              <Ionicons name="home" size={22} color={color} />
            </View>
          ),
        }}
      />

      {/* 🔍 EXPLORE */}
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#1e293b" : "transparent",
                padding: 8,
                borderRadius: 10,
              }}
            >
              <Ionicons name="compass" size={22} color={color} />
            </View>
          ),
        }}
      />

      {/* 🔔 ALERTS */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#1e293b" : "transparent",
                padding: 8,
                borderRadius: 10,
              }}
            >
              <Ionicons name="notifications" size={22} color={color} />
            </View>
          ),
        }}
      />

      {/* 👤 PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#1e293b" : "transparent",
                padding: 8,
                borderRadius: 10,
              }}
            >
              <Ionicons name="person" size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}