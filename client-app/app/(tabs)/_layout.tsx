import { Tabs } from "expo-router";
import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ==========================================
        // TAB BAR
        // ==========================================
        tabBarStyle: {
          position: "absolute",

          left: 14,
          right: 14,
          bottom: Math.max(insets.bottom, 8),

          height: 68,

          backgroundColor: "#ffffff",

          borderTopWidth: 0,
          borderRadius: 22,

          paddingTop: 7,
          paddingBottom: 7,

          elevation: 12,

          shadowColor: "#0f172a",
          shadowOffset: {
            width: 0,
            height: 5,
          },
          shadowOpacity: 0.12,
          shadowRadius: 12,
        },

        // ==========================================
        // COLORS
        // ==========================================
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#94a3b8",

        // ==========================================
        // LABEL
        // ==========================================
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 1,
        },

        // ==========================================
        // TAB ITEM
        // ==========================================
        tabBarItemStyle: {
          height: 60,
          paddingVertical: 2,
        },
      }}
    >
      {/* ==========================================
          HOME
      ========================================== */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",

          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="home"
              inactiveIcon="home-outline"
            />
          ),
        }}
      />

      {/* ==========================================
          EXPLORE
      ========================================== */}
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",

          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="compass"
              inactiveIcon="compass-outline"
            />
          ),
        }}
      />

      {/* ==========================================
          ALERTS
      ========================================== */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",

          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="notifications"
              inactiveIcon="notifications-outline"
            />
          ),
        }}
      />

      {/* ==========================================
          PROFILE
      ========================================== */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="person"
              inactiveIcon="person-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}

// ==================================================
// TAB ICON
// ==================================================

function TabIcon({
  focused,
  color,
  activeIcon,
  inactiveIcon,
}: {
  focused: boolean;
  color: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={[
        styles.iconContainer,
        focused && styles.activeIconContainer,
      ]}
    >
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={focused ? 24 : 23}
        color={color}
      />
    </View>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 32,

    justifyContent: "center",
    alignItems: "center",

    borderRadius: 12,
  },

  activeIconContainer: {
    backgroundColor: "#eff6ff",
  },
});