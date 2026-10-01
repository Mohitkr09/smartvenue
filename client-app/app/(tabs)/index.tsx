import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Image,
  Linking,
  Alert,
} from "react-native";

import axios from "axios";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { io, Socket } from "socket.io-client";
import polyline from "@mapbox/polyline";
import MapView, {
  Marker,
  Polyline,
  Circle,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* =====================================================
   CONFIGURATION
========================================================= */

const API_URL = "https://smartvenue.online";

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

/*
  Route is refreshed when:
  - user moves more than this distance
  - selected gate changes
*/
const ROUTE_REFRESH_DISTANCE = 100;

const LOCATION_DISTANCE_INTERVAL = 5;

/*
  Gate scoring weights.
  Lower final score = better gate.
*/
const CROWD_WEIGHT = 0.5;
const DISTANCE_WEIGHT = 0.3;
const RISK_WEIGHT = 0.2;

/* =========================================================
   TYPES
========================================================= */

type Coordinates = {
  latitude: number;
  longitude: number;
};

type Zone = {
  id?: string | number;
  gateId?: string | number;
  name?: string;

  lat: number;
  lng: number;

  crowdLevel?: number;
  capacity?: number;
  currentPeople?: number;

  riskScore?: number;
  riskLevel?: string;
};

type GateScore = Zone & {
  score: number;
  distanceFromUser: number;
  normalizedCrowd: number;
  normalizedDistance: number;
  normalizedRisk: number;
};

/* =========================================================
   HOME SCREEN
========================================================= */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  /* -------------------- STATE -------------------- */

  const [zones, setZones] = useState<Zone[]>([]);
  const [location, setLocation] = useState<Coordinates | null>(null);

  const [bestGate, setBestGate] = useState<GateScore | null>(null);

  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);

  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);

  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);

  const [userName, setUserName] = useState("User");

  const [isInEvent, setIsInEvent] = useState(false);

  const [locationPermission, setLocationPermission] = useState(false);

  const [routeLoading, setRouteLoading] = useState(false);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* -------------------- REFS -------------------- */

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const lastSpeech = useRef("");

  /*
    IMPORTANT:
    Using refs prevents stale React state inside
    Location.watchPositionAsync callback.
  */
  const bestGateRef = useRef<GateScore | null>(null);

  const locationRef = useRef<Coordinates | null>(null);

  const routeDestinationRef = useRef<Coordinates | null>(null);

  const lastRouteLocationRef = useRef<Coordinates | null>(null);

  const locationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(null);

  const socketRef = useRef<Socket | null>(null);

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  useEffect(() => {
    init();

    return () => {
      /*
        Cleanup GPS watcher
      */
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      /*
        Cleanup Socket.IO
      */
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      Speech.stop();
    };
  }, []);

  const init = async () => {
    try {
      await fetchUser();

      /*
        Fetch zones first so the application has gate
        information before navigation begins.
      */
      await fetchZones();

      /*
        Start GPS tracking after zones are available.
      */
      await startTracking();

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.log("Initialization error:", error);
    }
  };

  /* =========================================================
     USER
  ========================================================= */

  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        return;
      }

      const res = await axios.get(`${API_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUserName(res?.data?.user?.name || "User");
    } catch (error) {
      console.log("Fetch user error:", error);
    }
  };

  /* =========================================================
     LOCATION
  ========================================================= */

  const startTracking = async () => {
    try {
      setLocationLoading(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationPermission(false);
        setLocationLoading(false);

        Alert.alert(
          "Location Permission Required",
          "SmartVenue needs your location to detect the event and recommend the nearest safe gate."
        );

        return;
      }

      setLocationPermission(true);

      /*
        Get initial location.
      */
      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const initialCoords: Coordinates = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      updateUserLocation(initialCoords);

      /*
        Start continuous tracking.
      */
      locationSubscriptionRef.current =
        await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: LOCATION_DISTANCE_INTERVAL,
            timeInterval: 3000,
          },
          (loc) => {
            const coords: Coordinates = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };

            updateUserLocation(coords);
          }
        );
    } catch (error) {
      console.log("Location tracking error:", error);
    } finally {
      setLocationLoading(false);
    }
  };

  /* =========================================================
     UPDATE USER LOCATION
  ========================================================= */

  const updateUserLocation = useCallback(
    (coords: Coordinates) => {
      locationRef.current = coords;

      setLocation(coords);

      /*
        Calculate distance from event.
      */
      const eventDistance = getDistance(
        coords.latitude,
        coords.longitude,
        EVENT.lat,
        EVENT.lng
      );

      const insideEvent = eventDistance <= EVENT.radius;

      setIsInEvent(insideEvent);

      /*
        If user is outside event, clear navigation state.
      */
      if (!insideEvent) {
        setRouteCoords([]);
        setEta(0);
        setDistance(0);

        routeDestinationRef.current = null;
        lastRouteLocationRef.current = null;

        return;
      }

      /*
        Recalculate gate based on current location.
      */
      if (zones.length > 0) {
        const selectedGate = calculateBestGate(
          zones,
          coords
        );

        if (selectedGate) {
          const previousGateId =
            bestGateRef.current?.id ??
            bestGateRef.current?.gateId;

          const newGateId =
            selectedGate.id ??
            selectedGate.gateId;

          bestGateRef.current = selectedGate;

          setBestGate(selectedGate);

          /*
            If gate changed, fetch a new route.
          */
          if (previousGateId !== newGateId) {
            setRouteCoords([]);

            fetchRoute(coords, selectedGate);
          } else {
            /*
              Same gate:
              update distance and refresh route if needed.
            */
            updateNavigation(coords, selectedGate);
          }
        }
      }
    },
    [zones]
  );

  /* =========================================================
     FETCH ZONES
  ========================================================= */

  const fetchZones = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_URL}/zones`);

      const data: Zone[] = Array.isArray(res.data)
        ? res.data
        : [];

      setZones(data);

      setLastUpdated(new Date());

      /*
        If we already have user location,
        immediately calculate the best gate.
      */
      if (data.length > 0 && locationRef.current) {
        const selectedGate = calculateBestGate(
          data,
          locationRef.current
        );

        if (selectedGate) {
          bestGateRef.current = selectedGate;
          setBestGate(selectedGate);

          fetchRoute(
            locationRef.current,
            selectedGate
          );
        }
      }
    } catch (error) {
      console.log("Fetch zones error:", error);

      setZones([]);
      setBestGate(null);
      bestGateRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     SMART GATE SELECTION
  ========================================================= */

  const calculateBestGate = (
    zoneData: Zone[],
    userCoords: Coordinates
  ): GateScore | null => {
    if (!zoneData || zoneData.length === 0) {
      return null;
    }

    /*
      Calculate distance for every gate.
    */
    const gatesWithDistance = zoneData.map((zone) => {
      const gateDistance = getDistance(
        userCoords.latitude,
        userCoords.longitude,
        Number(zone.lat),
        Number(zone.lng)
      );

      return {
        ...zone,
        distanceFromUser: gateDistance,
      };
    });

    /*
      Maximum values used for normalization.
    */
    const maxDistance = Math.max(
      ...gatesWithDistance.map(
        (gate) => gate.distanceFromUser
      ),
      1
    );

    /*
      Create intelligent score.
    */
    const scoredGates: GateScore[] =
      gatesWithDistance.map((gate) => {
        /*
          Crowd:
          0% = best
          100% = worst
        */
        const crowd = Math.min(
          100,
          Math.max(0, Number(gate.crowdLevel ?? 0))
        );

        const normalizedCrowd = crowd / 100;

        /*
          Distance:
          Closer = better.
        */
        const normalizedDistance =
          gate.distanceFromUser / maxDistance;

        /*
          Risk:
          Support either riskScore or riskLevel.
        */
        let normalizedRisk = 0;

        if (gate.riskScore !== undefined) {
          normalizedRisk = Math.min(
            1,
            Math.max(0, Number(gate.riskScore))
          );
        } else if (gate.riskLevel) {
          const risk = gate.riskLevel.toLowerCase();

          if (risk === "high") {
            normalizedRisk = 1;
          } else if (risk === "medium") {
            normalizedRisk = 0.5;
          } else {
            normalizedRisk = 0;
          }
        }

        /*
          Final score.

          Lower = better.
        */
        const score =
          normalizedCrowd * CROWD_WEIGHT +
          normalizedDistance * DISTANCE_WEIGHT +
          normalizedRisk * RISK_WEIGHT;

        return {
          ...gate,
          score,
          normalizedCrowd,
          normalizedDistance,
          normalizedRisk,
        };
      });

    /*
      Lowest score wins.
    */
    scoredGates.sort(
      (a, b) => a.score - b.score
    );

    return scoredGates[0] || null;
  };

  /* =========================================================
     DISTANCE
  ========================================================= */

  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371e3;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return (
      2 *
      R *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      )
    );
  };

  /* =========================================================
     VOICE
  ========================================================= */

  const speak = (text: string) => {
    if (lastSpeech.current === text) {
      return;
    }

    Speech.stop();

    Speech.speak(text, {
      rate: 0.9,
      pitch: 1.0,
    });

    lastSpeech.current = text;
  };

  /* =========================================================
     ROUTE
  ========================================================= */

  const fetchRoute = async (
    user: Coordinates,
    gate: GateScore
  ) => {
    try {
      if (!gate) {
        return;
      }

      setRouteLoading(true);

      const destination = {
        latitude: Number(gate.lat),
        longitude: Number(gate.lng),
      };

      const res = await axios.post(
        `${API_URL}/route`,
        {
          origin: {
            lat: user.latitude,
            lng: user.longitude,
          },
          destination: {
            lat: destination.latitude,
            lng: destination.longitude,
          },
        },
        {
          timeout: 30000,
        }
      );

      if (!res.data?.routes?.length) {
        console.log("No route returned");
        return;
      }

      const route = res.data.routes[0];

      /*
        Google Directions-style response.
      */
      if (
        !route?.overview_polyline?.points
      ) {
        console.log("No polyline returned");
        return;
      }

      const points = polyline.decode(
        route.overview_polyline.points
      );

      const coordinates: Coordinates[] =
        points.map((point) => ({
          latitude: point[0],
          longitude: point[1],
        }));

      setRouteCoords(coordinates);

      /*
        Save route destination.
      */
      routeDestinationRef.current = destination;

      /*
        Save location from which route was calculated.
      */
      lastRouteLocationRef.current = user;

      /*
        ETA.
      */
      const duration =
        route?.legs?.[0]?.duration?.value;

      if (duration) {
        setEta(
          Math.max(
            1,
            Math.round(duration / 60)
          )
        );
      }

      /*
        Distance.
      */
      const routeDistance =
        route?.legs?.[0]?.distance?.value;

      if (routeDistance) {
        setDistance(
          Math.round(routeDistance)
        );
      } else {
        /*
          Fallback to straight-line distance.
        */
        setDistance(
          Math.round(
            getDistance(
              user.latitude,
              user.longitude,
              destination.latitude,
              destination.longitude
            )
          )
        );
      }
    } catch (error) {
      console.log("Route error:", error);
    } finally {
      setRouteLoading(false);
    }
  };

  /* =========================================================
     NAVIGATION UPDATE
  ========================================================= */

  const updateNavigation = (
    user: Coordinates,
    gate: GateScore
  ) => {
    if (!gate) {
      return;
    }

    const dist = getDistance(
      user.latitude,
      user.longitude,
      Number(gate.lat),
      Number(gate.lng)
    );

    /*
      Always show current straight-line distance.
      This makes UI update even before route refresh.
    */
    setDistance(Math.round(dist));

    /*
      If user is close to gate.
    */
    if (dist < 100) {
      speak(
        `You are near Gate ${gate.id ?? gate.gateId ?? ""}`
      );
    } else if (dist < 300) {
      speak(
        `Gate ${gate.id ?? gate.gateId ?? ""} is nearby`
      );
    }

    /*
      If no route exists, fetch one.
    */
    if (
      routeCoords.length === 0 ||
      !routeDestinationRef.current
    ) {
      fetchRoute(user, gate);
      return;
    }

    /*
      Check whether user moved enough
      to justify route recalculation.
    */
    if (lastRouteLocationRef.current) {
      const movedDistance = getDistance(
        lastRouteLocationRef.current.latitude,
        lastRouteLocationRef.current.longitude,
        user.latitude,
        user.longitude
      );

      if (
        movedDistance >= ROUTE_REFRESH_DISTANCE
      ) {
        fetchRoute(user, gate);
      }
    }
  };

  /* =========================================================
     MANUAL REFRESH
  ========================================================= */

  const handleRefresh = async () => {
    await fetchZones();

    /*
      Recalculate using current GPS.
    */
    if (locationRef.current) {
      const selectedGate = calculateBestGate(
        zones,
        locationRef.current
      );

      if (selectedGate) {
        bestGateRef.current = selectedGate;
        setBestGate(selectedGate);

        await fetchRoute(
          locationRef.current,
          selectedGate
        );
      }
    }
  };

  /* =========================================================
     GOOGLE MAPS
  ========================================================= */

  const openGoogleMaps = () => {
    if (!bestGate) {
      return;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${bestGate.lat},${bestGate.lng}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Navigation Error",
        "Unable to open Google Maps."
      );
    });
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    loading ||
    locationLoading ||
    !location
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#2563eb"
        />

        <Text style={styles.loadingText}>
          {locationLoading
            ? "Getting your location..."
            : "Loading SmartVenue..."}
        </Text>
      </View>
    );
  }

  /* =========================================================
     LOCATION PERMISSION
  ========================================================= */

  if (!locationPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>
          📍
        </Text>

        <Text style={styles.permissionTitle}>
          Location Required
        </Text>

        <Text style={styles.permissionText}>
          SmartVenue needs your location to detect
          nearby events and recommend the safest gate.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={startTracking}
        >
          <Text style={styles.primaryText}>
            Enable Location
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* =========================================================
     NO EVENT
  ========================================================= */

  if (!isInEvent) {
    return (
      <Animated.View
        style={[
          styles.homeContainer,
          {
            opacity: fadeAnim,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <Image
          source={{
            uri: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
          }}
          style={styles.homeImage}
        />

        <Text style={styles.homeTitle}>
          Hi, {userName} 👋
        </Text>

        <Text style={styles.homeSubtitle}>
          No event detected nearby
        </Text>

        <View style={styles.homeCard}>
          <Text style={styles.homeCardText}>
            📍 You are outside the event area
          </Text>

          <Text style={styles.homeTip}>
            SmartVenue will automatically detect
            when you enter the event zone.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleRefresh}
        >
          <Text style={styles.primaryText}>
            Refresh
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  /* =========================================================
     EVENT UI
  ========================================================= */

  const gateId =
    bestGate?.id ??
    bestGate?.gateId ??
    "Recommended";

  const crowdLevel = Math.round(
    Number(bestGate?.crowdLevel ?? 0)
  );

  const riskText =
    bestGate?.riskLevel ||
    (bestGate?.normalizedRisk ?? 0) >= 0.7
      ? "High"
      : (bestGate?.normalizedRisk ?? 0) >= 0.4
      ? "Medium"
      : "Low";

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* =====================================================
          MAP
      ===================================================== */}

      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation
          showsMyLocationButton
          followsUserLocation={false}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          {/* EVENT RADIUS */}

          <Circle
            center={{
              latitude: EVENT.lat,
              longitude: EVENT.lng,
            }}
            radius={EVENT.radius}
            strokeWidth={2}
            strokeColor="#2563eb"
            fillColor="rgba(37,99,235,0.08)"
          />

          {/* EVENT CENTER */}

          <Marker
            coordinate={{
              latitude: EVENT.lat,
              longitude: EVENT.lng,
            }}
            title="Event"
            description="SmartVenue Event"
          />

          {/* ALL GATES */}

          {zones.map((zone, index) => {
            const isBest =
              String(
                zone.id ?? zone.gateId
              ) === String(gateId);

            return (
              <Marker
                key={
                  zone.id ??
                  zone.gateId ??
                  index
                }
                coordinate={{
                  latitude: Number(zone.lat),
                  longitude: Number(zone.lng),
                }}
                title={`Gate ${
                  zone.id ??
                  zone.gateId ??
                  index + 1
                }`}
                description={`Crowd: ${
                  zone.crowdLevel ?? 0
                }%`}
              >
                <View
                  style={[
                    styles.marker,
                    isBest &&
                      styles.bestMarker,
                  ]}
                >
                  <Text style={styles.markerText}>
                    {isBest ? "⭐" : "G"}
                  </Text>
                </View>
              </Marker>
            );
          })}

          {/* NAVIGATION ROUTE */}

          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeWidth={6}
              strokeColor="#2563eb"
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      </View>

      {/* =====================================================
          TOP STATUS
      ===================================================== */}

      <View
        style={[
          styles.topStatus,
          {
            top: insets.top + 10,
          },
        ]}
      >
        <Text style={styles.topStatusText}>
          🟢 Inside Event
        </Text>
      </View>

      {/* =====================================================
          INFO CARD
      ===================================================== */}

      <View
        style={[
          styles.card,
          {
            bottom: insets.bottom + 20,
          },
        ]}
      >
        <Text style={styles.banner}>
          🎉 SmartVenue Navigation
        </Text>

        <Text style={styles.recommended}>
          Recommended Gate
        </Text>

        <Text style={styles.gate}>
          Gate {gateId}
        </Text>

        {/* CROWD */}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            🚦 Crowd
          </Text>

          <Text style={styles.infoValue}>
            {crowdLevel}%
          </Text>
        </View>

        <View style={styles.crowdBar}>
          <View
            style={[
              styles.crowdFill,
              {
                width: `${Math.min(
                  100,
                  Math.max(0, crowdLevel)
                )}%`,
              },
              crowdLevel >= 80
                ? styles.crowdHigh
                : crowdLevel >= 50
                ? styles.crowdMedium
                : styles.crowdLow,
            ]}
          />
        </View>

        {/* ETA */}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            ⏱ ETA
          </Text>

          <Text style={styles.infoValue}>
            {routeLoading
              ? "Calculating..."
              : `${eta || "--"} min`}
          </Text>
        </View>

        {/* DISTANCE */}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            📏 Distance
          </Text>

          <Text style={styles.infoValue}>
            {distance >= 1000
              ? `${(distance / 1000).toFixed(
                  1
                )} km`
              : `${distance} m`}
          </Text>
        </View>

        {/* RISK */}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            🛡 Risk
          </Text>

          <Text style={styles.infoValue}>
            {riskText}
          </Text>
        </View>

        {/* WHY THIS GATE */}

        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>
            Why this gate?
          </Text>

          <Text style={styles.reasonText}>
            Selected using crowd level, walking
            distance and crowd-risk factors.
          </Text>
        </View>

        {/* NAVIGATE */}

        <TouchableOpacity
          style={styles.btn}
          onPress={openGoogleMaps}
        >
          <Text style={styles.btnText}>
            🧭 Navigate to Gate {gateId}
          </Text>
        </TouchableOpacity>

        {/* REFRESH */}

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
        >
          <Text style={styles.refreshText}>
            🔄 Refresh Crowd Data
          </Text>
        </TouchableOpacity>

        {lastUpdated && (
          <Text style={styles.updatedText}>
            Updated{" "}
            {lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  mapContainer: {
    flex: 1,
    overflow: "hidden",
  },

  map: {
    flex: 1,
  },

  /* =====================================================
     CENTER
  ===================================================== */

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },

  /* =====================================================
     TOP STATUS
  ===================================================== */

  topStatus: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,

    elevation: 6,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },

  topStatusText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#16a34a",
  },

  /* =====================================================
     HOME
  ===================================================== */

  homeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#f1f5f9",

    paddingHorizontal: 20,
  },

  homeImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },

  homeTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },

  homeSubtitle: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 15,
    textAlign: "center",
  },

  homeCard: {
    backgroundColor: "white",

    padding: 18,

    borderRadius: 16,

    marginTop: 24,

    width: "100%",

    alignItems: "center",

    elevation: 3,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },

  homeCardText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#0f172a",
    textAlign: "center",
  },

  homeTip: {
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },

  /* =====================================================
     BUTTONS
  ===================================================== */

  primaryBtn: {
    backgroundColor: "#2563eb",

    paddingVertical: 14,
    paddingHorizontal: 20,

    borderRadius: 12,

    marginTop: 20,

    width: "100%",

    alignItems: "center",

    elevation: 3,
  },

  primaryText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },

  /* =====================================================
     CARD
  ===================================================== */

  card: {
    position: "absolute",

    left: 15,
    right: 15,

    backgroundColor: "white",

    padding: 18,

    borderRadius: 22,

    elevation: 10,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },

  banner: {
    textAlign: "center",
    color: "#16a34a",
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 6,
  },

  recommended: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },

  gate: {
    textAlign: "center",

    fontWeight: "800",

    fontSize: 26,

    color: "#0f172a",

    marginTop: 2,
    marginBottom: 12,
  },

  /* =====================================================
     INFO ROW
  ===================================================== */

  infoRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginTop: 6,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 14,
  },

  infoValue: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },

  /* =====================================================
     CROWD BAR
  ===================================================== */

  crowdBar: {
    height: 7,

    backgroundColor: "#e2e8f0",

    borderRadius: 10,

    marginTop: 7,
    marginBottom: 6,

    overflow: "hidden",
  },

  crowdFill: {
    height: "100%",
    borderRadius: 10,
  },

  crowdLow: {
    backgroundColor: "#22c55e",
  },

  crowdMedium: {
    backgroundColor: "#f59e0b",
  },

  crowdHigh: {
    backgroundColor: "#ef4444",
  },

  /* =====================================================
     REASON
  ===================================================== */

  reasonBox: {
    backgroundColor: "#eff6ff",

    borderRadius: 12,

    padding: 12,

    marginTop: 12,
  },

  reasonTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1d4ed8",
  },

  reasonText: {
    fontSize: 12,
    color: "#475569",

    marginTop: 4,

    lineHeight: 17,
  },

  /* =====================================================
     NAVIGATION BUTTON
  ===================================================== */

  btn: {
    backgroundColor: "#2563eb",

    paddingVertical: 14,

    borderRadius: 12,

    marginTop: 13,

    alignItems: "center",

    elevation: 3,
  },

  btnText: {
    color: "white",

    fontWeight: "800",

    fontSize: 15,
  },

  /* =====================================================
     REFRESH
  ===================================================== */

  refreshBtn: {
    alignItems: "center",

    paddingVertical: 9,

    marginTop: 3,
  },

  refreshText: {
    color: "#2563eb",

    fontSize: 13,

    fontWeight: "700",
  },

  updatedText: {
    textAlign: "center",

    fontSize: 10,

    color: "#94a3b8",

    marginTop: 2,
  },

  /* =====================================================
     MARKERS
  ===================================================== */

  marker: {
    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor: "#2563eb",

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 3,
    borderColor: "white",

    elevation: 5,
  },

  bestMarker: {
    backgroundColor: "#16a34a",

    width: 44,
    height: 44,

    borderRadius: 22,
  },

  markerText: {
    color: "white",

    fontWeight: "900",

    fontSize: 15,
  },

  /* =====================================================
     PERMISSION
  ===================================================== */

  permissionContainer: {
    flex: 1,

    justifyContent: "center",

    alignItems: "center",

    paddingHorizontal: 30,

    backgroundColor: "#f8fafc",
  },

  permissionIcon: {
    fontSize: 55,

    marginBottom: 15,
  },

  permissionTitle: {
    fontSize: 24,

    fontWeight: "800",

    color: "#0f172a",

    textAlign: "center",
  },

  permissionText: {
    marginTop: 10,

    textAlign: "center",

    color: "#64748b",

    lineHeight: 21,

    fontSize: 14,
  },
});