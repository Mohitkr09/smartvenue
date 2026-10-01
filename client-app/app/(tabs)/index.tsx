import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

/* =========================================================
   CONFIG
========================================================= */

const SERVER_URL =
  "https://smartvenue-4qvd.onrender.com";

const AI_URL =
  "https://smartvenue-u3vr.onrender.com";

const SOCKET_URL = SERVER_URL;

/*
  Mobile app should NOT call AI directly.

  Correct architecture:

  Mobile
     ↓
  Node/Express
     ↓
  AI Flask Service
     ↓
  MongoDB
     ↓
  Socket.IO
     ↓
  Mobile
*/

const EVENT = {
  lat: 25.4484,
  lng: 78.5685,
  radius: 1200,
};

const ROUTE_REFRESH_DISTANCE = 100;
const LOCATION_DISTANCE_INTERVAL = 5;

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

  /*
    AI information returned by backend.
  */
  prediction?: string;

  futureCrowd?: number;
  aiScore?: number;
  aiStatus?: string;
  aiSuggestion?: string;
  aiIsBest?: boolean;
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

  /* ---------------- STATE ---------------- */

  const [zones, setZones] = useState<Zone[]>([]);
  const [location, setLocation] =
    useState<Coordinates | null>(null);

  const [bestGate, setBestGate] =
    useState<GateScore | null>(null);

  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] =
    useState(true);

  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);

  const [routeCoords, setRouteCoords] =
    useState<Coordinates[]>([]);

  const [userName, setUserName] =
    useState("User");

  const [isInEvent, setIsInEvent] =
    useState(false);

  const [locationPermission, setLocationPermission] =
    useState(false);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  /* ---------------- REFS ---------------- */

  const fadeAnim =
    useRef(new Animated.Value(0)).current;

  const socketRef =
    useRef<Socket | null>(null);

  const locationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(
      null
    );

  const locationRef =
    useRef<Coordinates | null>(null);

  const bestGateRef =
    useRef<GateScore | null>(null);

  const routeDestinationRef =
    useRef<Coordinates | null>(null);

  const lastRouteLocationRef =
    useRef<Coordinates | null>(null);

  const lastSpeech =
    useRef("");

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  useEffect(() => {
    init();

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

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

      await fetchZones();

      connectSocket();

      await startTracking();

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.log(
        "Initialization error:",
        error
      );
    }
  };

  /* =========================================================
     SOCKET.IO
  ========================================================= */

  const connectSocket = () => {
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const socket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 15000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log(
          "Socket connected:",
          socket.id
        );
      });

      socket.on("connect_error", (error) => {
        console.log(
          "Socket connection error:",
          error.message
        );
      });

      socket.on("disconnect", (reason) => {
        console.log(
          "Socket disconnected:",
          reason
        );
      });

      /*
        Backend emits:

        zoneUpdate

        whenever new IoT/AI data is processed.
      */

      socket.on(
        "zoneUpdate",
        (incomingZones: Zone[]) => {
          if (!Array.isArray(incomingZones)) {
            return;
          }

          console.log(
            "Received zoneUpdate:",
            incomingZones.length
          );

          setZones(incomingZones);

          setLastUpdated(new Date());

          const currentLocation =
            locationRef.current;

          if (
            currentLocation &&
            incomingZones.length > 0
          ) {
            const selectedGate =
              calculateBestGate(
                incomingZones,
                currentLocation
              );

            if (selectedGate) {
              const oldId =
                bestGateRef.current?.id ??
                bestGateRef.current?.gateId;

              const newId =
                selectedGate.id ??
                selectedGate.gateId;

              bestGateRef.current =
                selectedGate;

              setBestGate(selectedGate);

              if (
                String(oldId) !==
                String(newId)
              ) {
                setRouteCoords([]);

                fetchRoute(
                  currentLocation,
                  selectedGate
                );
              } else {
                updateNavigation(
                  currentLocation,
                  selectedGate
                );
              }
            }
          }
        }
      );
    } catch (error) {
      console.log(
        "Socket setup error:",
        error
      );
    }
  };

  /* =========================================================
     USER
  ========================================================= */

  const fetchUser = async () => {
    try {
      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        return;
      }

      const response =
        await axios.get(
          `${SERVER_URL}/user/profile`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setUserName(
        response?.data?.user?.name ||
          "User"
      );
    } catch (error) {
      console.log(
        "Fetch user error:",
        error
      );
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

        Alert.alert(
          "Location Permission Required",
          "SmartVenue needs your location to recommend the safest gate."
        );

        return;
      }

      setLocationPermission(true);

      const currentLocation =
        await Location.getCurrentPositionAsync(
          {
            accuracy:
              Location.Accuracy.High,
          }
        );

      const initialCoords: Coordinates = {
        latitude:
          currentLocation.coords.latitude,
        longitude:
          currentLocation.coords.longitude,
      };

      updateUserLocation(initialCoords);

      locationSubscriptionRef.current =
        await Location.watchPositionAsync(
          {
            accuracy:
              Location.Accuracy.High,
            distanceInterval:
              LOCATION_DISTANCE_INTERVAL,
            timeInterval: 3000,
          },
          (loc) => {
            const coords: Coordinates = {
              latitude:
                loc.coords.latitude,
              longitude:
                loc.coords.longitude,
            };

            updateUserLocation(coords);
          }
        );
    } catch (error) {
      console.log(
        "Location tracking error:",
        error
      );
    } finally {
      setLocationLoading(false);
    }
  };

  /* =========================================================
     LOCATION UPDATE
  ========================================================= */

  const updateUserLocation = useCallback(
    (coords: Coordinates) => {
      locationRef.current = coords;

      setLocation(coords);

      const eventDistance =
        getDistance(
          coords.latitude,
          coords.longitude,
          EVENT.lat,
          EVENT.lng
        );

      const insideEvent =
        eventDistance <= EVENT.radius;

      setIsInEvent(insideEvent);

      if (!insideEvent) {
        setRouteCoords([]);
        setEta(0);
        setDistance(0);

        routeDestinationRef.current =
          null;

        lastRouteLocationRef.current =
          null;

        return;
      }

      if (zones.length === 0) {
        return;
      }

      const selectedGate =
        calculateBestGate(
          zones,
          coords
        );

      if (!selectedGate) {
        return;
      }

      const previousGateId =
        bestGateRef.current?.id ??
        bestGateRef.current?.gateId;

      const newGateId =
        selectedGate.id ??
        selectedGate.gateId;

      bestGateRef.current =
        selectedGate;

      setBestGate(selectedGate);

      if (
        String(previousGateId) !==
        String(newGateId)
      ) {
        setRouteCoords([]);

        fetchRoute(
          coords,
          selectedGate
        );
      } else {
        updateNavigation(
          coords,
          selectedGate
        );
      }
    },
    [zones]
  );

  /* =========================================================
     FETCH ZONES
  ========================================================= */

  const fetchZones = async (): Promise<
    Zone[]
  > => {
    try {
      setLoading(true);

      const response =
        await axios.get(
          `${SERVER_URL}/zones`,
          {
            timeout: 15000,
          }
        );

      const data: Zone[] =
        Array.isArray(response.data)
          ? response.data
          : [];

      setZones(data);

      setLastUpdated(new Date());

      if (
        data.length > 0 &&
        locationRef.current
      ) {
        const selectedGate =
          calculateBestGate(
            data,
            locationRef.current
          );

        if (selectedGate) {
          bestGateRef.current =
            selectedGate;

          setBestGate(selectedGate);
        }
      }

      return data;
    } catch (error) {
      console.log(
        "Fetch zones error:",
        error
      );

      return [];
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
    if (
      !zoneData ||
      zoneData.length === 0
    ) {
      return null;
    }

    const gatesWithDistance =
      zoneData.map((zone) => {
        const gateDistance =
          getDistance(
            userCoords.latitude,
            userCoords.longitude,
            Number(zone.lat),
            Number(zone.lng)
          );

        return {
          ...zone,
          distanceFromUser:
            gateDistance,
        };
      });

    const maxDistance =
      Math.max(
        ...gatesWithDistance.map(
          (gate) =>
            gate.distanceFromUser
        ),
        1
      );

    const scoredGates: GateScore[] =
      gatesWithDistance.map(
        (gate) => {
          /*
            Current crowd.
          */

          const crowd = Math.min(
            100,
            Math.max(
              0,
              Number(
                gate.crowdLevel ?? 0
              )
            )
          );

          /*
            Use AI predicted crowd when
            backend provides it.
          */

          const futureCrowd =
            gate.futureCrowd !==
            undefined
              ? Number(
                  gate.futureCrowd
                )
              : crowd;

          /*
            Prefer AI forecast for
            crowd decision.
          */

          const effectiveCrowd =
            Math.min(
              100,
              Math.max(
                0,
                futureCrowd
              )
            );

          const normalizedCrowd =
            effectiveCrowd / 100;

          /*
            Distance.
          */

          const normalizedDistance =
            gate.distanceFromUser /
            maxDistance;

          /*
            IMPORTANT FIX:

            riskScore is 0-100,
            therefore divide by 100.

            Previous code incorrectly
            used riskScore directly.
          */

          let normalizedRisk = 0;

          if (
            gate.riskScore !==
            undefined
          ) {
            normalizedRisk =
              Math.min(
                1,
                Math.max(
                  0,
                  Number(
                    gate.riskScore
                  ) / 100
                )
              );
          } else if (
            gate.riskLevel
          ) {
            const risk =
              gate.riskLevel.toLowerCase();

            if (risk === "high") {
              normalizedRisk = 1;
            } else if (
              risk === "medium" ||
              risk === "moderate"
            ) {
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
            normalizedCrowd *
              CROWD_WEIGHT +
            normalizedDistance *
              DISTANCE_WEIGHT +
            normalizedRisk *
              RISK_WEIGHT;

          return {
            ...gate,
            score,
            normalizedCrowd,
            normalizedDistance,
            normalizedRisk,
          };
        }
      );

    scoredGates.sort(
      (a, b) =>
        a.score - b.score
    );

    return (
      scoredGates[0] || null
    );
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
      ((lat2 - lat1) *
        Math.PI) /
      180;

    const dLon =
      ((lon2 - lon1) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(
        (lat1 * Math.PI) / 180
      ) *
        Math.cos(
          (lat2 * Math.PI) / 180
        ) *
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
     SPEECH
  ========================================================= */

  const speak = (text: string) => {
    if (
      lastSpeech.current === text
    ) {
      return;
    }

    Speech.stop();

    Speech.speak(text, {
      rate: 0.9,
      pitch: 1,
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

      const response =
        await axios.post(
          `${SERVER_URL}/route`,
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

      if (
        !response.data?.routes
          ?.length
      ) {
        console.log(
          "No route returned"
        );

        return;
      }

      const route =
        response.data.routes[0];

      if (
        !route?.overview_polyline
          ?.points
      ) {
        console.log(
          "No polyline returned"
        );

        return;
      }

      const points =
        polyline.decode(
          route
            .overview_polyline
            .points
        );

      const coordinates: Coordinates[] =
        points.map(
          (point) => ({
            latitude: point[0],
            longitude: point[1],
          })
        );

      setRouteCoords(
        coordinates
      );

      routeDestinationRef.current =
        destination;

      lastRouteLocationRef.current =
        user;

      const duration =
        route?.legs?.[0]
          ?.duration?.value;

      if (duration) {
        setEta(
          Math.max(
            1,
            Math.round(
              duration / 60
            )
          )
        );
      }

      const routeDistance =
        route?.legs?.[0]
          ?.distance?.value;

      if (routeDistance) {
        setDistance(
          Math.round(
            routeDistance
          )
        );
      } else {
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
      console.log(
        "Route error:",
        error
      );
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

    const dist =
      getDistance(
        user.latitude,
        user.longitude,
        Number(gate.lat),
        Number(gate.lng)
      );

    setDistance(
      Math.round(dist)
    );

    const gateName =
      gate.id ??
      gate.gateId ??
      "";

    if (dist < 100) {
      speak(
        `You are near Gate ${gateName}`
      );
    } else if (dist < 300) {
      speak(
        `Gate ${gateName} is nearby`
      );
    }

    if (
      routeCoords.length === 0 ||
      !routeDestinationRef.current
    ) {
      fetchRoute(
        user,
        gate
      );

      return;
    }

    if (
      lastRouteLocationRef.current
    ) {
      const movedDistance =
        getDistance(
          lastRouteLocationRef
            .current.latitude,
          lastRouteLocationRef
            .current.longitude,
          user.latitude,
          user.longitude
        );

      if (
        movedDistance >=
        ROUTE_REFRESH_DISTANCE
      ) {
        fetchRoute(
          user,
          gate
        );
      }
    }
  };

  /* =========================================================
     REFRESH
  ========================================================= */

  const handleRefresh = async () => {
    const latestZones =
      await fetchZones();

    if (
      locationRef.current &&
      latestZones.length > 0
    ) {
      const selectedGate =
        calculateBestGate(
          latestZones,
          locationRef.current
        );

      if (selectedGate) {
        bestGateRef.current =
          selectedGate;

        setBestGate(
          selectedGate
        );

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

    Linking.openURL(url).catch(
      () => {
        Alert.alert(
          "Navigation Error",
          "Unable to open Google Maps."
        );
      }
    );
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

        <Text
          style={
            styles.loadingText
          }
        >
          {locationLoading
            ? "Getting your location..."
            : "Loading SmartVenue..."}
        </Text>
      </View>
    );
  }

  /* =========================================================
     PERMISSION
  ========================================================= */

  if (!locationPermission) {
    return (
      <View
        style={
          styles.permissionContainer
        }
      >
        <Text
          style={
            styles.permissionIcon
          }
        >
          📍
        </Text>

        <Text
          style={
            styles.permissionTitle
          }
        >
          Location Required
        </Text>

        <Text
          style={
            styles.permissionText
          }
        >
          SmartVenue needs your
          location to detect the event
          and recommend the safest
          gate.
        </Text>

        <TouchableOpacity
          style={
            styles.primaryBtn
          }
          onPress={
            startTracking
          }
        >
          <Text
            style={
              styles.primaryText
            }
          >
            Enable Location
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* =========================================================
     OUTSIDE EVENT
  ========================================================= */

  if (!isInEvent) {
    return (
      <Animated.View
        style={[
          styles.homeContainer,
          {
            opacity: fadeAnim,
            paddingBottom:
              insets.bottom + 20,
          },
        ]}
      >
        <Image
          source={{
            uri:
              "https://cdn-icons-png.flaticon.com/512/854/854878.png",
          }}
          style={
            styles.homeImage
          }
        />

        <Text
          style={
            styles.homeTitle
          }
        >
          Hi, {userName} 👋
        </Text>

        <Text
          style={
            styles.homeSubtitle
          }
        >
          No event detected nearby
        </Text>

        <View
          style={
            styles.homeCard
          }
        >
          <Text
            style={
              styles.homeCardText
            }
          >
            📍 You are outside the
            event area
          </Text>

          <Text
            style={
              styles.homeTip
            }
          >
            SmartVenue will
            automatically detect when
            you enter the event zone.
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.primaryBtn
          }
          onPress={
            handleRefresh
          }
        >
          <Text
            style={
              styles.primaryText
            }
          >
            Refresh
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  /* =========================================================
     EVENT DATA
  ========================================================= */

  const gateId =
    bestGate?.id ??
    bestGate?.gateId ??
    "Recommended";

  const crowdLevel =
    Math.round(
      Number(
        bestGate?.crowdLevel ?? 0
      )
    );

  const futureCrowd =
    bestGate?.futureCrowd !==
    undefined
      ? Math.round(
          Number(
            bestGate.futureCrowd
          )
        )
      : null;

  const riskText =
    bestGate?.riskLevel ||
    ((bestGate?.normalizedRisk ??
      0) >= 0.7
      ? "High"
      : (bestGate?.normalizedRisk ??
          0) >= 0.4
      ? "Medium"
      : "Low");

  const aiSuggestion =
    bestGate?.aiSuggestion ||
    bestGate?.prediction ||
    "Selected using crowd, distance and risk.";

  /* =========================================================
     UI
  ========================================================= */

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <View
        style={
          styles.mapContainer
        }
      >
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation
          showsMyLocationButton
          followsUserLocation={false}
          initialRegion={{
            latitude:
              location.latitude,
            longitude:
              location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
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

          <Marker
            coordinate={{
              latitude: EVENT.lat,
              longitude: EVENT.lng,
            }}
            title="Event"
            description="SmartVenue Event"
          />

          {zones.map(
            (zone, index) => {
              const isBest =
                String(
                  zone.id ??
                    zone.gateId
                ) ===
                String(gateId);

              return (
                <Marker
                  key={
                    zone.id ??
                    zone.gateId ??
                    index
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
                    `Gate ${
                      zone.id ??
                      zone.gateId ??
                      index + 1
                    }`
                  }
                  description={
                    `Crowd: ${
                      zone.crowdLevel ??
                      0
                    }%`
                  }
                >
                  <View
                    style={[
                      styles.marker,
                      isBest &&
                        styles.bestMarker,
                    ]}
                  >
                    <Text
                      style={
                        styles.markerText
                      }
                    >
                      {isBest
                        ? "⭐"
                        : "G"}
                    </Text>
                  </View>
                </Marker>
              );
            }
          )}

          {routeCoords.length >
            0 && (
            <Polyline
              coordinates={
                routeCoords
              }
              strokeWidth={6}
              strokeColor="#2563eb"
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      </View>

      {/* TOP STATUS */}

      <View
        style={[
          styles.topStatus,
          {
            top:
              insets.top + 10,
          },
        ]}
      >
        <Text
          style={
            styles.topStatusText
          }
        >
          🟢 Inside Event
        </Text>
      </View>

      {/* INFO CARD */}

      <View
        style={[
          styles.card,
          {
            bottom:
              insets.bottom + 20,
          },
        ]}
      >
        <Text
          style={styles.banner}
        >
          🎉 SmartVenue Navigation
        </Text>

        <Text
          style={
            styles.recommended
          }
        >
          Recommended Gate
        </Text>

        <Text
          style={styles.gate}
        >
          Gate {gateId}
        </Text>

        {/* CURRENT CROWD */}

        <View
          style={styles.infoRow}
        >
          <Text
            style={
              styles.infoLabel
            }
          >
            🚦 Current Crowd
          </Text>

          <Text
            style={
              styles.infoValue
            }
          >
            {crowdLevel}%
          </Text>
        </View>

        <View
          style={
            styles.crowdBar
          }
        >
          <View
            style={[
              styles.crowdFill,
              {
                width:
                  `${Math.min(
                    100,
                    Math.max(
                      0,
                      crowdLevel
                    )
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

        {/* AI FUTURE CROWD */}

        {futureCrowd !==
          null && (
          <View
            style={
              styles.infoRow
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              🤖 AI Forecast
            </Text>

            <Text
              style={
                styles.infoValue
              }
            >
              {futureCrowd}%
            </Text>
          </View>
        )}

        {/* ETA */}

        <View
          style={styles.infoRow}
        >
          <Text
            style={
              styles.infoLabel
            }
          >
            ⏱ ETA
          </Text>

          <Text
            style={
              styles.infoValue
            }
          >
            {routeLoading
              ? "Calculating..."
              : `${eta || "--"} min`}
          </Text>
        </View>

        {/* DISTANCE */}

        <View
          style={styles.infoRow}
        >
          <Text
            style={
              styles.infoLabel
            }
          >
            📏 Distance
          </Text>

          <Text
            style={
              styles.infoValue
            }
          >
            {distance >= 1000
              ? `${(
                  distance /
                  1000
                ).toFixed(1)} km`
              : `${distance} m`}
          </Text>
        </View>

        {/* RISK */}

        <View
          style={styles.infoRow}
        >
          <Text
            style={
              styles.infoLabel
            }
          >
            🛡 Risk
          </Text>

          <Text
            style={
              styles.infoValue
            }
          >
            {riskText}
          </Text>
        </View>

        {/* AI SUGGESTION */}

        <View
          style={
            styles.reasonBox
          }
        >
          <Text
            style={
              styles.reasonTitle
            }
          >
            🤖 AI Recommendation
          </Text>

          <Text
            style={
              styles.reasonText
            }
          >
            {aiSuggestion}
          </Text>
        </View>

        {/* NAVIGATE */}

        <TouchableOpacity
          style={styles.btn}
          onPress={
            openGoogleMaps
          }
        >
          <Text
            style={
              styles.btnText
            }
          >
            🧭 Navigate to Gate{" "}
            {gateId}
          </Text>
        </TouchableOpacity>

        {/* REFRESH */}

        <TouchableOpacity
          style={
            styles.refreshBtn
          }
          onPress={
            handleRefresh
          }
        >
          <Text
            style={
              styles.refreshText
            }
          >
            🔄 Refresh Crowd Data
          </Text>
        </TouchableOpacity>

        {lastUpdated && (
          <Text
            style={
              styles.updatedText
            }
          >
            Updated{" "}
            {lastUpdated.toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            )}
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