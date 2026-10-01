import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  connectSocket,
  disconnectSocket,
  getSocket,
} from "../services/socket";

// ============================================================
// TYPES
// ============================================================

type Zone = {
  _id?: string;
  id?: string;
  name?: string;

  crowdLevel?: number;
  waitTime?: number;

  status?: "Smooth" | "Moderate" | "High";

  riskScore?: number;
  riskLevel?: "Low" | "Medium" | "High";

  futureCrowd?: number;
  aiScore?: number;
  aiStatus?: "LOW" | "MEDIUM" | "HIGH";
  aiSuggestion?: string;
  aiIsBest?: boolean;

  prediction?: string;
};

type AlertType = "danger" | "warning" | "safe" | "ai";

type AlertItem = {
  id: string;
  zoneName: string;
  message: string;
  type: AlertType;
  time: Date;
  crowd?: number;
  futureCrowd?: number;
  aiSuggestion?: string;
};

// ============================================================
// COMPONENT
// ============================================================

export default function Alerts() {
  const insets = useSafeAreaInsets();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Used to prevent repeated identical alerts
  const lastAlertRef = useRef<Record<string, number>>({});

  // ==========================================================
  // ANIMATION
  // ==========================================================

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // ==========================================================
  // SOCKET CONNECTION
  // ==========================================================

  useEffect(() => {
    const socket = connectSocket();

    if (!socket) {
      return;
    }

    const handleConnect = () => {
      console.log("🟢 Alerts socket connected");
      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log("🔴 Alerts socket disconnected");
      setConnected(false);
    };

    const handleConnectError = (error: any) => {
      console.log("❌ Alerts socket error:", error?.message);
      setConnected(false);
    };

    const handleZoneUpdate = (data: Zone[] | Zone) => {
      try {
        if (!data) return;

        /*
         * Backend sends:
         *
         * zoneUpdate -> [
         *   Gate A,
         *   Gate B,
         *   Gate C,
         *   Gate D
         * ]
         *
         * We also support a single zone just in case.
         */

        const zones: Zone[] = Array.isArray(data) ? data : [data];

        processZoneUpdates(zones);
      } catch (error: any) {
        console.log(
          "❌ Alert zoneUpdate error:",
          error?.message
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("zoneUpdate", handleZoneUpdate);

    setConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("zoneUpdate", handleZoneUpdate);

      /*
       * Do not disconnect the shared socket here if other
       * SmartVenue screens are using it.
       */
    };
  }, []);

  // ==========================================================
  // PROCESS ZONE UPDATES
  // ==========================================================

  const processZoneUpdates = (zones: Zone[]) => {
    const newAlerts: AlertItem[] = [];

    zones.forEach((zone) => {
      if (!zone) return;

      const zoneName =
        zone.name ||
        zone.id ||
        "Unknown Gate";

      const crowd = Number(zone.crowdLevel ?? 0);
      const futureCrowd = Number(
        zone.futureCrowd ?? crowd
      );

      // ======================================================
      // 1. OVERCROWDING ALERT
      // ======================================================

      if (crowd > 80) {
        addAlertIfAllowed(
          newAlerts,
          {
            id: `${zoneName}-overcrowded`,
            zoneName,
            message: `${zoneName} is overcrowded. Consider another gate.`,
            type: "danger",
            time: new Date(),
            crowd,
          }
        );
      }

      // ======================================================
      // 2. HIGH RISK ALERT
      // ======================================================

      else if (
        zone.riskLevel === "High" ||
        Number(zone.riskScore ?? 0) > 70
      ) {
        addAlertIfAllowed(
          newAlerts,
          {
            id: `${zoneName}-high-risk`,
            zoneName,
            message: `${zoneName} currently has high crowd risk.`,
            type: "danger",
            time: new Date(),
            crowd,
          }
        );
      }

      // ======================================================
      // 3. MODERATE CROWD ALERT
      // ======================================================

      else if (
        crowd > 60 ||
        zone.status === "Moderate"
      ) {
        addAlertIfAllowed(
          newAlerts,
          {
            id: `${zoneName}-moderate`,
            zoneName,
            message: `${zoneName} has moderate crowd levels.`,
            type: "warning",
            time: new Date(),
            crowd,
          }
        );
      }

      // ======================================================
      // 4. FUTURE CROWD INCREASE
      // ======================================================

      if (
        futureCrowd > crowd + 15 &&
        futureCrowd > 50
      ) {
        addAlertIfAllowed(
          newAlerts,
          {
            id: `${zoneName}-future-increase`,
            zoneName,
            message: `Crowd is expected to increase at ${zoneName}.`,
            type: "warning",
            time: new Date(),
            crowd,
            futureCrowd,
          }
        );
      }

      // ======================================================
      // 5. AI RECOMMENDED GATE
      // ======================================================

      if (
        zone.aiIsBest === true &&
        zone.aiSuggestion
      ) {
        addAlertIfAllowed(
          newAlerts,
          {
            id: `${zoneName}-ai-best`,
            zoneName,
            message: `${zoneName}: ${zone.aiSuggestion}`,
            type: "ai",
            time: new Date(),
            crowd,
            futureCrowd,
            aiSuggestion: zone.aiSuggestion,
          }
        );
      }

      // ======================================================
      // 6. SAFE GATE
      // ======================================================

      if (
        crowd < 30 &&
        zone.riskLevel === "Low"
      ) {
        addAlertIfAllowed(
          newAlerts,
          {
            id: `${zoneName}-safe`,
            zoneName,
            message: `${zoneName} currently has low crowd levels.`,
            type: "safe",
            time: new Date(),
            crowd,
          }
        );
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((previous) => {
        const combined = [
          ...newAlerts,
          ...previous,
        ];

        // Keep only latest 50 alerts
        return combined.slice(0, 50);
      });
    }
  };

  // ==========================================================
  // DUPLICATE ALERT PROTECTION
  // ==========================================================

  const addAlertIfAllowed = (
    target: AlertItem[],
    alert: AlertItem
  ) => {
    const now = Date.now();

    const lastTime =
      lastAlertRef.current[alert.id] || 0;

    /*
     * Same alert won't appear more than once
     * every 60 seconds.
     */
    if (now - lastTime < 60000) {
      return;
    }

    lastAlertRef.current[alert.id] = now;

    target.push(alert);
  };

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      const socket = getSocket();

      if (!socket || !socket.connected) {
        const newSocket = connectSocket();

        setConnected(
          Boolean(newSocket?.connected)
        );
      }
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setTimeout(() => {
        setRefreshing(false);
      }, 700);
    }
  };

  // ==========================================================
  // CLEAR ALERTS
  // ==========================================================

  const clearAlerts = () => {
    setAlerts([]);
    lastAlertRef.current = {};
  };

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const stats = useMemo(() => {
    return {
      total: alerts.length,

      danger: alerts.filter(
        (item) => item.type === "danger"
      ).length,

      warning: alerts.filter(
        (item) => item.type === "warning"
      ).length,

      safe: alerts.filter(
        (item) => item.type === "safe"
      ).length,

      ai: alerts.filter(
        (item) => item.type === "ai"
      ).length,
    };
  }, [alerts]);

  // ==========================================================
  // TIME FORMAT
  // ==========================================================

  const getTimeText = (date: Date) => {
    const diff =
      Math.floor(
        (Date.now() - date.getTime()) / 1000
      );

    if (diff < 10) return "Just now";

    if (diff < 60) {
      return `${diff}s ago`;
    }

    const minutes = Math.floor(diff / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ==========================================================
  // ALERT ICON
  // ==========================================================

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case "danger":
        return "🚨";

      case "warning":
        return "⚠️";

      case "ai":
        return "🤖";

      case "safe":
        return "✅";

      default:
        return "🔔";
    }
  };

  // ==========================================================
  // ALERT TITLE
  // ==========================================================

  const getAlertTitle = (type: AlertType) => {
    switch (type) {
      case "danger":
        return "High Risk";

      case "warning":
        return "Crowd Warning";

      case "ai":
        return "AI Recommendation";

      case "safe":
        return "Gate Update";

      default:
        return "Alert";
    }
  };

  // ==========================================================
  // RENDER ALERT
  // ==========================================================

  const renderAlert = ({
    item,
  }: {
    item: AlertItem;
  }) => {
    const icon = getAlertIcon(item.type);
    const title = getAlertTitle(item.type);

    return (
      <View style={styles.alertCard}>

        {/* ICON */}
        <View
          style={[
            styles.iconContainer,
            item.type === "danger" &&
              styles.dangerIcon,
            item.type === "warning" &&
              styles.warningIcon,
            item.type === "safe" &&
              styles.safeIcon,
            item.type === "ai" &&
              styles.aiIcon,
          ]}
        >
          <Text style={styles.icon}>
            {icon}
          </Text>
        </View>

        {/* CONTENT */}
        <View style={styles.alertContent}>

          <View style={styles.alertTopRow}>
            <Text style={styles.alertTitle}>
              {title}
            </Text>

            <Text style={styles.alertTime}>
              {getTimeText(item.time)}
            </Text>
          </View>

          <Text style={styles.zoneName}>
            {item.zoneName}
          </Text>

          <Text style={styles.alertMessage}>
            {item.message}
          </Text>

          {/* CROWD INFO */}
          {(item.crowd !== undefined ||
            item.futureCrowd !== undefined) && (
            <View style={styles.infoRow}>

              {item.crowd !== undefined && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoText}>
                    👥 {Math.round(item.crowd)}%
                  </Text>
                </View>
              )}

              {item.futureCrowd !== undefined && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoText}>
                    📈 Future {Math.round(item.futureCrowd)}%
                  </Text>
                </View>
              )}
            </View>
          )}

        </View>
      </View>
    );
  };

  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>

      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyIcon}>
          🔔
        </Text>
      </View>

      <Text style={styles.emptyTitle}>
        You're all clear
      </Text>

      <Text style={styles.emptySub}>
        SmartVenue will show crowd warnings,
        AI recommendations and gate updates here.
      </Text>

      <View style={styles.liveBadge}>
        <View
          style={[
            styles.liveDot,
            {
              backgroundColor: connected
                ? "#22c55e"
                : "#94a3b8",
            },
          ]}
        />

        <Text style={styles.liveText}>
          {connected
            ? "Monitoring gates live"
            : "Connecting to SmartVenue"}
        </Text>
      </View>

    </View>
  );

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <SafeAreaView style={styles.safe}>

      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            paddingTop: Math.max(
              insets.top,
              10
            ),
          },
        ]}
      >

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <View style={styles.headerRow}>

          <View>
            <Text style={styles.header}>
              Live Alerts
            </Text>

            <Text style={styles.subtitle}>
              Real-time crowd intelligence
            </Text>
          </View>

          <View style={styles.connectionBadge}>

            <View
              style={[
                styles.connectionDot,
                {
                  backgroundColor: connected
                    ? "#22c55e"
                    : "#ef4444",
                },
              ]}
            />

            <Text
              style={[
                styles.connectionText,
                {
                  color: connected
                    ? "#15803d"
                    : "#dc2626",
                },
              ]}
            >
              {connected
                ? "LIVE"
                : "OFFLINE"}
            </Text>

          </View>

        </View>

        {/* ================================================== */}
        {/* STATS */}
        {/* ================================================== */}

        <View style={styles.statsContainer}>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {stats.total}
            </Text>
            <Text style={styles.statLabel}>
              Alerts
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text
              style={[
                styles.statNumber,
                { color: "#dc2626" },
              ]}
            >
              {stats.danger}
            </Text>
            <Text style={styles.statLabel}>
              Critical
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text
              style={[
                styles.statNumber,
                { color: "#d97706" },
              ]}
            >
              {stats.warning}
            </Text>
            <Text style={styles.statLabel}>
              Warnings
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text
              style={[
                styles.statNumber,
                { color: "#16a34a" },
              ]}
            >
              {stats.safe}
            </Text>
            <Text style={styles.statLabel}>
              Safe
            </Text>
          </View>

        </View>

        {/* ================================================== */}
        {/* ACTION BAR */}
        {/* ================================================== */}

        {alerts.length > 0 && (
          <View style={styles.actionRow}>

            <Text style={styles.recentText}>
              Recent updates
            </Text>

            <TouchableOpacity
              onPress={clearAlerts}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>
                Clear
              </Text>
            </TouchableOpacity>

          </View>
        )}

        {/* ================================================== */}
        {/* ALERT LIST */}
        {/* ================================================== */}

        {alerts.length === 0 ? (
          renderEmpty()
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) =>
              item.id + item.time.getTime()
            }
            renderItem={renderAlert}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom:
                insets.bottom + 110,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          />
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // ==========================================================
  // HEADER
  // ==========================================================

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },

  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 3,
  },

  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  connectionText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // ==========================================================
  // STATS
  // ==========================================================

  statsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },

  statNumber: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0f172a",
  },

  statLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "600",
  },

  // ==========================================================
  // ACTION
  // ==========================================================

  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  recentText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },

  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },

  clearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },

  // ==========================================================
  // ALERT CARD
  // ==========================================================

  alertCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 14,
    marginBottom: 10,

    elevation: 3,

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    marginRight: 12,
  },

  dangerIcon: {
    backgroundColor: "#fee2e2",
  },

  warningIcon: {
    backgroundColor: "#fef3c7",
  },

  safeIcon: {
    backgroundColor: "#dcfce7",
  },

  aiIcon: {
    backgroundColor: "#ede9fe",
  },

  icon: {
    fontSize: 21,
  },

  alertContent: {
    flex: 1,
  },

  alertTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  alertTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
  },

  alertTime: {
    fontSize: 10,
    color: "#94a3b8",
  },

  zoneName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 4,
  },

  alertMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
    marginTop: 3,
  },

  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 9,
    gap: 6,
  },

  infoBadge: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  infoText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },

  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingBottom: 80,
  },

  emptyIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyIcon: {
    fontSize: 34,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },

  emptySub: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 18,
    elevation: 2,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },

  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
});