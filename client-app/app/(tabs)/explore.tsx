import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";

import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";

import {
  connectSocket,
} from "../../services/socket";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import axios from "axios";

// ============================================================
// CONFIG
// ============================================================

const API_URL = "https://smartvenue-4qvd.onrender.com";

// ============================================================
// EVENT
// ============================================================

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

// ============================================================
// TYPES
// ============================================================

type Zone = {
  _id?: string;
  id?: string;

  name: string;

  lat: number;
  lng: number;

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

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Explore() {
  const insets = useSafeAreaInsets();

  const [zones, setZones] = useState<Zone[]>([]);
  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [locationLoading, setLocationLoading] =
    useState(true);

  const [socketConnected, setSocketConnected] =
    useState(false);

  // ==========================================================
  // INITIALIZE
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await getLocation();

        await fetchZones();

        const socket = connectSocket();

        if (!socket) {
          return;
        }

        if (mounted) {
          setSocketConnected(socket.connected);
        }

        // ------------------------------------------
        // SOCKET CONNECT
        // ------------------------------------------

        const handleConnect = () => {
          console.log(
            "🟢 Explore socket connected"
          );

          if (mounted) {
            setSocketConnected(true);
          }
        };

        // ------------------------------------------
        // SOCKET DISCONNECT
        // ------------------------------------------

        const handleDisconnect = () => {
          console.log(
            "🔴 Explore socket disconnected"
          );

          if (mounted) {
            setSocketConnected(false);
          }
        };

        // ------------------------------------------
        // REALTIME ZONE UPDATE
        // ------------------------------------------

        const handleRealtime = (
          data: Zone[] | Zone
        ) => {
          if (!data) return;

          /*
           * Backend sends:
           *
           * zoneUpdate -> finalZones[]
           *
           * Support both array and single object.
           */

          const incomingZones = Array.isArray(data)
            ? data
            : [data];

          setZones(incomingZones);
        };

        socket.on(
          "connect",
          handleConnect
        );

        socket.on(
          "disconnect",
          handleDisconnect
        );

        socket.on(
          "zoneUpdate",
          handleRealtime
        );

        // ------------------------------------------
        // CLEANUP
        // ------------------------------------------

        return () => {
          socket.off(
            "connect",
            handleConnect
          );

          socket.off(
            "disconnect",
            handleDisconnect
          );

          socket.off(
            "zoneUpdate",
            handleRealtime
          );
        };
      } catch (error) {
        console.log(
          "❌ Explore initialization error:",
          error
        );
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // LOCATION
  // ==========================================================

  const getLocation = async () => {
    try {
      setLocationLoading(true);

      const {
        status,
      } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log(
          "❌ Location permission denied"
        );

        return;
      }

      const loc =
        await Location.getCurrentPositionAsync({
          accuracy:
            Location.Accuracy.High,
        });

      setLocation(loc.coords);
    } catch (error) {
      console.log(
        "❌ Location error:",
        error
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // ==========================================================
  // FETCH ZONES
  // ==========================================================

  const fetchZones = async () => {
    try {
      const response =
        await axios.get(
          `${API_URL}/zones`,
          {
            timeout: 15000,
          }
        );

      const data =
        Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

      setZones(data);
    } catch (error: any) {
      console.log(
        "❌ Fetch zones error:",
        error?.message
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ==========================================================
  // REFRESH
  // ==========================================================

  const onRefresh = async () => {
    setRefreshing(true);

    await Promise.all([
      getLocation(),
      fetchZones(),
    ]);
  };

  // ==========================================================
  // DISTANCE
  // ==========================================================

  const getDistance = (
    zone: {
      lat: number;
      lng: number;
    }
  ) => {
    if (!location) {
      return 99999;
    }

    const R = 6371;

    const dLat =
      ((zone.lat -
        location.latitude) *
        Math.PI) /
      180;

    const dLon =
      ((zone.lng -
        location.longitude) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(
        (location.latitude *
          Math.PI) /
          180
      ) *
        Math.cos(
          (zone.lat * Math.PI) /
            180
        ) *
        Math.sin(dLon / 2) ** 2;

    return Math.round(
      R *
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        ) *
        1000
    );
  };

  // ==========================================================
  // ETA
  // ==========================================================

  const getETA = (distance: number) => {
    return Math.max(
      1,
      Math.round(distance / 80)
    );
  };

  // ==========================================================
  // EVENT CHECK
  // ==========================================================

  const isEvent = () => {
    if (!location) {
      return false;
    }

    return (
      getDistance({
        lat: EVENT.lat,
        lng: EVENT.lng,
      }) <= EVENT.radius
    );
  };

  // ==========================================================
  // CROWD COLOR
  // ==========================================================

  const getCrowdColor = (
    crowd: number
  ) => {
    if (crowd >= 70) {
      return "#ef4444";
    }

    if (crowd >= 30) {
      return "#f59e0b";
    }

    return "#22c55e";
  };

  // ==========================================================
  // RISK COLOR
  // ==========================================================

  const getRiskColor = (
    risk?: string
  ) => {
    switch (risk) {
      case "High":
      case "HIGH":
        return "#ef4444";

      case "Medium":
      case "MEDIUM":
        return "#f59e0b";

      default:
        return "#22c55e";
    }
  };

  // ==========================================================
  // RISK LABEL
  // ==========================================================

  const getRiskLabel = (
    risk?: string
  ) => {
    switch (risk) {
      case "High":
      case "HIGH":
        return "High Risk";

      case "Medium":
      case "MEDIUM":
        return "Moderate";

      default:
        return "Low Risk";
    }
  };

  // ==========================================================
  // BEST GATE
  // ==========================================================

  const bestGate = useMemo(() => {
    if (
      !zones.length ||
      !location
    ) {
      return null;
    }

    /*
     * Prefer AI-selected gate.
     */

    const aiGate = zones.find(
      (zone) =>
        zone.aiIsBest === true
    );

    if (aiGate) {
      return aiGate;
    }

    /*
     * Fallback calculation.
     *
     * Lower score = better.
     */

    const scored = zones.map(
      (zone) => {
        const crowd =
          Number(
            zone.crowdLevel ?? 0
          );

        const futureCrowd =
          Number(
            zone.futureCrowd ??
              crowd
          );

        const risk =
          Number(
            zone.riskScore ?? 0
          );

        const distance =
          getDistance(zone);

        const normalizedDistance =
          Math.min(
            distance / 1000,
            1
          ) * 100;

        const score =
          crowd * 0.35 +
          futureCrowd * 0.30 +
          risk * 0.20 +
          normalizedDistance *
            0.15;

        return {
          ...zone,
          calculatedScore: score,
        };
      }
    );

    scored.sort(
      (a, b) =>
        a.calculatedScore -
        b.calculatedScore
    );

    return scored[0];
  }, [zones, location]);

  // ==========================================================
  // EVENT DISTANCE
  // ==========================================================

  const eventDistance = location
    ? getDistance({
        lat: EVENT.lat,
        lng: EVENT.lng,
      })
    : 0;

  // ==========================================================
  // OVERALL CROWD
  // ==========================================================

  const averageCrowd = useMemo(() => {
    if (!zones.length) {
      return 0;
    }

    const total = zones.reduce(
      (sum, zone) =>
        sum +
        Number(
          zone.crowdLevel ?? 0
        ),
      0
    );

    return Math.round(
      total / zones.length
    );
  }, [zones]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const openNavigation = (
    gate: Zone
  ) => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${gate.lat},${gate.lng}`
    );
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading ||
    locationLoading ||
    !location
  ) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingCard}>
          <ActivityIndicator
            size="large"
            color="#2563eb"
          />

          <Text style={styles.loadingTitle}>
            Preparing SmartVenue
          </Text>

          <Text style={styles.loadingText}>
            Getting your location and
            crowd information...
          </Text>
        </View>
      </View>
    );
  }

  // ==========================================================
  // NO EVENT
  // ==========================================================

  if (!isEvent()) {
    return (
      <SafeAreaView
        style={styles.safe}
      >
        <View
          style={styles.backgroundTop}
        />

        <View
          style={[
            styles.noEventHeader,
            {
              paddingTop:
                insets.top + 10,
            },
          ]}
        >
          <Text
            style={styles.appTitle}
          >
            SmartVenue
          </Text>

          <View
            style={styles.statusPill}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    socketConnected
                      ? "#22c55e"
                      : "#94a3b8",
                },
              ]}
            />

            <Text
              style={styles.statusText}
            >
              {socketConnected
                ? "LIVE"
                : "OFFLINE"}
            </Text>
          </View>
        </View>

        <View
          style={styles.emptyContainer}
        >
          <View
            style={styles.emptyCard}
          >
            <View
              style={styles.emptyIconCircle}
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                📍
              </Text>
            </View>

            <Text
              style={styles.emptyTitle}
            >
              No Event Nearby
            </Text>

            <Text
              style={styles.emptySub}
            >
              You're currently{" "}
              {eventDistance}m away from
              the SmartVenue event area.
              Move closer to unlock
              real-time crowd navigation.
            </Text>

            <View
              style={styles.featureRow}
            >
              <View
                style={
                  styles.featureItem
                }
              >
                <Text
                  style={
                    styles.featureIcon
                  }
                >
                  🤖
                </Text>

                <Text
                  style={
                    styles.featureText
                  }
                >
                  AI Routing
                </Text>
              </View>

              <View
                style={
                  styles.featureItem
                }
              >
                <Text
                  style={
                    styles.featureIcon
                  }
                >
                  👥
                </Text>

                <Text
                  style={
                    styles.featureText
                  }
                >
                  Live Crowd
                </Text>
              </View>

              <View
                style={
                  styles.featureItem
                }
              >
                <Text
                  style={
                    styles.featureIcon
                  }
                >
                  🛡️
                </Text>

                <Text
                  style={
                    styles.featureText
                  }
                >
                  Safe Gates
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={
                styles.primaryBtn
              }
              onPress={
                onRefresh
              }
            >
              <Text
                style={
                  styles.primaryText
                }
              >
                🔄 Refresh Location
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.secondaryBtn
              }
              onPress={() =>
                Linking.openURL(
                  "https://www.google.com/maps/search/events+near+me"
                )
              }
            >
              <Text
                style={
                  styles.secondaryText
                }
              >
                📍 Find Events Nearby
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // EVENT UI
  // ==========================================================

  return (
    <SafeAreaView
      style={styles.safe}
    >
      <FlatList
        data={zones}
        keyExtractor={(item, index) =>
          item._id ||
          item.id ||
          item.name ||
          `gate-${index}`
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingBottom:
            insets.bottom + 110,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              onRefresh
            }
          />
        }
        ListHeaderComponent={
          <>
            {/* ============================================ */}
            {/* HEADER */}
            {/* ============================================ */}

            <View
              style={
                styles.mainHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.mainTitle
                  }
                >
                  Explore
                </Text>

                <Text
                  style={
                    styles.mainSubtitle
                  }
                >
                  Smart crowd navigation
                </Text>
              </View>

              <View
                style={
                  styles.liveContainer
                }
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        socketConnected
                          ? "#22c55e"
                          : "#ef4444",
                    },
                  ]}
                />

                <Text
                  style={
                    styles.liveText
                  }
                >
                  {socketConnected
                    ? "LIVE"
                    : "OFFLINE"}
                </Text>
              </View>
            </View>

            {/* ============================================ */}
            {/* EVENT STATUS */}
            {/* ============================================ */}

            <View
              style={
                styles.eventBanner
              }
            >
              <View
                style={
                  styles.eventIcon
                }
              >
                <Text>
                  🎪
                </Text>
              </View>

              <View
                style={
                  styles.eventInfo
                }
              >
                <Text
                  style={
                    styles.eventTitle
                  }
                >
                  Event Area Active
                </Text>

                <Text
                  style={
                    styles.eventSubtitle
                  }
                >
                  You're inside the
                  SmartVenue navigation
                  zone
                </Text>
              </View>

              <View
                style={
                  styles.distanceBadge
                }
              >
                <Text
                  style={
                    styles.distanceBadgeText
                  }
                >
                  {eventDistance}m
                </Text>
              </View>
            </View>

            {/* ============================================ */}
            {/* BEST GATE HERO */}
            {/* ============================================ */}

            {bestGate && (
              <View
                style={
                  styles.bestGateHero
                }
              >
                <View
                  style={
                    styles.bestTopRow
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.bestLabel
                      }
                    >
                      🤖 AI RECOMMENDED GATE
                    </Text>

                    <Text
                      style={
                        styles.bestGateName
                      }
                    >
                      {bestGate.name}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.bestBadge
                    }
                  >
                    <Text
                      style={
                        styles.bestBadgeText
                      }
                    >
                      BEST
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.heroStats
                  }
                >
                  <View
                    style={
                      styles.heroStat
                    }
                  >
                    <Text
                      style={
                        styles.heroStatValue
                      }
                    >
                      {Math.round(
                        bestGate.crowdLevel ??
                          0
                      )}
                      %
                    </Text>

                    <Text
                      style={
                        styles.heroStatLabel
                      }
                    >
                      Current Crowd
                    </Text>
                  </View>

                  <View
                    style={
                      styles.heroDivider
                    }
                  />

                  <View
                    style={
                      styles.heroStat
                    }
                  >
                    <Text
                      style={
                        styles.heroStatValue
                      }
                    >
                      {Math.round(
                        bestGate.futureCrowd ??
                          bestGate.crowdLevel ??
                          0
                      )}
                      %
                    </Text>

                    <Text
                      style={
                        styles.heroStatLabel
                      }
                    >
                      Future Crowd
                    </Text>
                  </View>

                  <View
                    style={
                      styles.heroDivider
                    }
                  />

                  <View
                    style={
                      styles.heroStat
                    }
                  >
                    <Text
                      style={
                        styles.heroStatValue
                      }
                    >
                      {getETA(
                        getDistance(
                          bestGate
                        )
                      )}
                      m
                    </Text>

                    <Text
                      style={
                        styles.heroStatLabel
                      }
                    >
                      ETA
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.aiSuggestion
                  }
                >
                  💡{" "}
                  {bestGate.aiSuggestion ||
                    bestGate.prediction ||
                    "This gate currently has favorable crowd conditions."}
                </Text>

                <TouchableOpacity
                  style={
                    styles.heroButton
                  }
                  onPress={() =>
                    openNavigation(
                      bestGate
                    )
                  }
                >
                  <Text
                    style={
                      styles.heroButtonText
                    }
                  >
                    🧭 Navigate to{" "}
                    {bestGate.name}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ============================================ */}
            {/* SUMMARY */}
            {/* ============================================ */}

            <View
              style={
                styles.summaryRow
              }
            >
              <View
                style={
                  styles.summaryCard
                }
              >
                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {zones.length}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Gates
                </Text>
              </View>

              <View
                style={
                  styles.summaryCard
                }
              >
                <Text
                  style={[
                    styles.summaryNumber,
                    {
                      color:
                        getCrowdColor(
                          averageCrowd
                        ),
                    },
                  ]}
                >
                  {averageCrowd}%
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Avg Crowd
                </Text>
              </View>

              <View
                style={
                  styles.summaryCard
                }
              >
                <Text
                  style={[
                    styles.summaryNumber,
                    {
                      color:
                        "#22c55e",
                    },
                  ]}
                >
                  LIVE
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  AI Data
                </Text>
              </View>
            </View>

            {/* ============================================ */}
            {/* MAP */}
            {/* ============================================ */}

            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Live Gate Map
              </Text>

              <Text
                style={
                  styles.sectionSub
                }
              >
                Tap a gate
              </Text>
            </View>

            <View
              style={
                styles.mapWrapper
              }
            >
              <MapView
                style={styles.map}
                showsUserLocation
                showsMyLocationButton
                initialRegion={{
                  latitude:
                    location.latitude,
                  longitude:
                    location.longitude,
                  latitudeDelta:
                    0.01,
                  longitudeDelta:
                    0.01,
                }}
              >
                {zones.map(
                  (zone, index) => {
                    const crowd =
                      Number(
                        zone.crowdLevel ??
                          0
                      );

                    const isBest =
                      bestGate?.name ===
                      zone.name;

                    return (
                      <Marker
                        key={
                          zone._id ||
                          zone.id ||
                          `${zone.name}-${index}`
                        }
                        coordinate={{
                          latitude:
                            Number(
                              zone.lat
                            ),
                          longitude:
                            Number(
                              zone.lng
                            ),
                        }}
                        title={
                          zone.name
                        }
                        description={`${crowd}% crowd`}
                      >
                        <View
                          style={[
                            styles.marker,
                            {
                              backgroundColor:
                                getCrowdColor(
                                  crowd
                                ),
                            },
                            isBest &&
                              styles.bestMarker,
                          ]}
                        >
                          <Text
                            style={
                              styles.markerText
                            }
                          >
                            {Math.round(
                              crowd
                            )}
                          </Text>
                        </View>
                      </Marker>
                    );
                  }
                )}
              </MapView>

              <View
                style={
                  styles.mapLegend
                }
              >
                <View
                  style={
                    styles.legendItem
                  }
                >
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor:
                          "#22c55e",
                      },
                    ]}
                  />

                  <Text
                    style={
                      styles.legendText
                    }
                  >
                    Low
                  </Text>
                </View>

                <View
                  style={
                    styles.legendItem
                  }
                >
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor:
                          "#f59e0b",
                      },
                    ]}
                  />

                  <Text
                    style={
                      styles.legendText
                    }
                  >
                    Medium
                  </Text>
                </View>

                <View
                  style={
                    styles.legendItem
                  }
                >
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor:
                          "#ef4444",
                      },
                    ]}
                  />

                  <Text
                    style={
                      styles.legendText
                    }
                  >
                    High
                  </Text>
                </View>
              </View>
            </View>

            {/* ============================================ */}
            {/* GATES */}
            {/* ============================================ */}

            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Available Gates
              </Text>

              <Text
                style={
                  styles.sectionSub
                }
              >
                {zones.length} gates
              </Text>
            </View>
          </>
        }
        renderItem={({
          item,
        }) => {
          const distance =
            getDistance(item);

          const eta =
            getETA(distance);

          const crowd =
            Number(
              item.crowdLevel ?? 0
            );

          const futureCrowd =
            Number(
              item.futureCrowd ??
                crowd
            );

          const isBest =
            bestGate?.name ===
            item.name;

          const crowdColor =
            getCrowdColor(
              crowd
            );

          const riskColor =
            getRiskColor(
              item.riskLevel
            );

          return (
            <View
              style={[
                styles.gateCard,
                isBest &&
                  styles.gateCardBest,
              ]}
            >
              {/* ======================================== */}
              {/* CARD HEADER */}
              {/* ======================================== */}

              <View
                style={
                  styles.gateHeader
                }
              >
                <View
                  style={
                    styles.gateNameRow
                  }
                >
                  <View
                    style={[
                      styles.gateStatusDot,
                      {
                        backgroundColor:
                          crowdColor,
                      },
                    ]}
                  />

                  <Text
                    style={
                      styles.gateName
                    }
                  >
                    {item.name}
                  </Text>
                </View>

                {isBest && (
                  <View
                    style={
                      styles.recommendedBadge
                    }
                  >
                    <Text
                      style={
                        styles.recommendedText
                      }
                    >
                      🤖 AI BEST
                    </Text>
                  </View>
                )}
              </View>

              {/* ======================================== */}
              {/* CROWD PROGRESS */}
              {/* ======================================== */}

              <View
                style={
                  styles.crowdHeader
                }
              >
                <Text
                  style={
                    styles.crowdLabel
                  }
                >
                  Current Crowd
                </Text>

                <Text
                  style={[
                    styles.crowdValue,
                    {
                      color:
                        crowdColor,
                    },
                  ]}
                >
                  {Math.round(
                    crowd
                  )}
                  %
                </Text>
              </View>

              <View
                style={
                  styles.progressBackground
                }
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        crowd,
                        100
                      )}%`,
                      backgroundColor:
                        crowdColor,
                    },
                  ]}
                />
              </View>

              {/* ======================================== */}
              {/* METRICS */}
              {/* ======================================== */}

              <View
                style={
                  styles.metricsRow
                }
              >
                <View
                  style={
                    styles.metric
                  }
                >
                  <Text
                    style={
                      styles.metricIcon
                    }
                  >
                    📍
                  </Text>

                  <View>
                    <Text
                      style={
                        styles.metricValue
                      }
                    >
                      {distance}m
                    </Text>

                    <Text
                      style={
                        styles.metricLabel
                      }
                    >
                      Distance
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.metric
                  }
                >
                  <Text
                    style={
                      styles.metricIcon
                    }
                  >
                    ⏱️
                  </Text>

                  <View>
                    <Text
                      style={
                        styles.metricValue
                      }
                    >
                      {eta} min
                    </Text>

                    <Text
                      style={
                        styles.metricLabel
                      }
                    >
                      ETA
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.metric
                  }
                >
                  <Text
                    style={
                      styles.metricIcon
                    }
                  >
                    📈
                  </Text>

                  <View>
                    <Text
                      style={
                        styles.metricValue
                      }
                    >
                      {Math.round(
                        futureCrowd
                      )}
                      %
                    </Text>

                    <Text
                      style={
                        styles.metricLabel
                      }
                    >
                      Future
                    </Text>
                  </View>
                </View>
              </View>

              {/* ======================================== */}
              {/* RISK */}
              {/* ======================================== */}

              <View
                style={
                  styles.riskRow
                }
              >
                <View
                  style={
                    styles.riskLeft
                  }
                >
                  <View
                    style={[
                      styles.riskDot,
                      {
                        backgroundColor:
                          riskColor,
                      },
                    ]}
                  />

                  <Text
                    style={
                      styles.riskText
                    }
                  >
                    {getRiskLabel(
                      item.riskLevel
                    )}
                  </Text>
                </View>

                {item.waitTime !==
                  undefined && (
                  <Text
                    style={
                      styles.waitText
                    }
                  >
                    ⏳ {item.waitTime} min
                    wait
                  </Text>
                )}
              </View>

              {/* ======================================== */}
              {/* AI SUGGESTION */}
              {/* ======================================== */}

              {item.aiSuggestion && (
                <View
                  style={
                    styles.aiBox
                  }
                >
                  <Text
                    style={
                      styles.aiBoxTitle
                    }
                  >
                    🤖 SmartVenue AI
                  </Text>

                  <Text
                    style={
                      styles.aiBoxText
                    }
                  >
                    {item.aiSuggestion}
                  </Text>
                </View>
              )}

              {/* ======================================== */}
              {/* NAVIGATION */}
              {/* ======================================== */}

              <TouchableOpacity
                style={[
                  styles.navigateButton,
                  isBest &&
                    styles.navigateButtonBest,
                ]}
                onPress={() =>
                  openNavigation(
                    item
                  )
                }
                activeOpacity={0.8}
              >
                <Text
                  style={
                    styles.navigateText
                  }
                >
                  🧭 Navigate to{" "}
                  {item.name}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    padding: 25,
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "85%",
    elevation: 5,
  },

  loadingTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },

  loadingText: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },

  // ==========================================================
  // NO EVENT
  // ==========================================================

  backgroundTop: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: "42%",
    backgroundColor: "#2563eb",
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
  },

  noEventHeader: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  appTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  statusText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  emptyCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 25,
    alignItems: "center",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  emptyIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyIcon: {
    fontSize: 38,
  },

  emptyTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0f172a",
  },

  emptySub: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 20,
    color: "#64748b",
    fontSize: 13,
  },

  featureRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  featureItem: {
    alignItems: "center",
    flex: 1,
  },

  featureIcon: {
    fontSize: 22,
  },

  featureText: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },

  primaryBtn: {
    width: "100%",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  primaryText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  secondaryBtn: {
    width: "100%",
    backgroundColor: "#e2e8f0",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  secondaryText: {
    color: "#334155",
    fontWeight: "700",
  },

  // ==========================================================
  // MAIN HEADER
  // ==========================================================

  mainHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },

  mainSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },

  liveContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 2,
  },

  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },

  // ==========================================================
  // EVENT BANNER
  // ==========================================================

  eventBanner: {
    marginHorizontal: 15,
    marginBottom: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },

  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },

  eventInfo: {
    flex: 1,
    marginLeft: 10,
  },

  eventTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },

  eventSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },

  distanceBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },

  distanceBadgeText: {
    fontSize: 10,
    color: "#2563eb",
    fontWeight: "800",
  },

  // ==========================================================
  // BEST GATE
  // ==========================================================

  bestGateHero: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },

  bestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  bestLabel: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  bestGateName: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 4,
  },

  bestBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },

  bestBadgeText: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: "900",
  },

  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },

  heroStat: {
    flex: 1,
    alignItems: "center",
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },

  heroStatLabel: {
    color: "#dbeafe",
    fontSize: 9,
    marginTop: 3,
  },

  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  aiSuggestion: {
    color: "#eff6ff",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },

  heroButton: {
    backgroundColor: "#ffffff",
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 15,
  },

  heroButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
  },

  // ==========================================================
  // SUMMARY
  // ==========================================================

  summaryRow: {
    flexDirection: "row",
    gap: 9,
    marginHorizontal: 15,
    marginBottom: 18,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 15,
    paddingVertical: 13,
    alignItems: "center",
    elevation: 2,
  },

  summaryNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },

  summaryLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "600",
  },

  // ==========================================================
  // SECTION
  // ==========================================================

  sectionHeader: {
    marginHorizontal: 15,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },

  sectionSub: {
    fontSize: 11,
    color: "#64748b",
  },

  // ==========================================================
  // MAP
  // ==========================================================

  mapWrapper: {
    marginHorizontal: 15,
    height: 230,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 18,
    elevation: 4,
  },

  map: {
    flex: 1,
  },

  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    elevation: 5,
  },

  bestMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "#2563eb",
  },

  markerText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  mapLegend: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-around",
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },

  legendText: {
    fontSize: 9,
    color: "#475569",
    fontWeight: "600",
  },

  // ==========================================================
  // GATE CARD
  // ==========================================================

  gateCard: {
    marginHorizontal: 15,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 19,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  gateCardBest: {
    borderWidth: 2,
    borderColor: "#2563eb",
  },

  gateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  gateNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  gateStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  gateName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },

  recommendedBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },

  recommendedText: {
    color: "#2563eb",
    fontSize: 9,
    fontWeight: "900",
  },

  // ==========================================================
  // CROWD
  // ==========================================================

  crowdHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 6,
  },

  crowdLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },

  crowdValue: {
    fontSize: 14,
    fontWeight: "900",
  },

  progressBackground: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
  },

  // ==========================================================
  // METRICS
  // ==========================================================

  metricsRow: {
    flexDirection: "row",
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },

  metric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  metricIcon: {
    fontSize: 16,
    marginRight: 6,
  },

  metricValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },

  metricLabel: {
    fontSize: 9,
    color: "#94a3b8",
    marginTop: 1,
  },

  // ==========================================================
  // RISK
  // ==========================================================

  riskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },

  riskLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  riskText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },

  waitText: {
    fontSize: 10,
    color: "#64748b",
  },

  // ==========================================================
  // AI BOX
  // ==========================================================

  aiBox: {
    marginTop: 12,
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },

  aiBoxTitle: {
    color: "#6d28d9",
    fontSize: 10,
    fontWeight: "900",
  },

  aiBoxText: {
    color: "#5b21b6",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  navigateButton: {
    marginTop: 14,
    backgroundColor: "#0f172a",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },

  navigateButtonBest: {
    backgroundColor: "#2563eb",
  },

  navigateText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
});