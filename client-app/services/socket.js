import { io } from "socket.io-client";

// ==============================
// 🧠 CONFIG (PRODUCTION READY)
// ==============================

// ✅ Use DOMAIN in production
const SOCKET_URL = __DEV__
  ? "http://18.214.178.1:5000" // dev (Expo / local testing)
  : "https://smartvenue.online"; // production (NGINX + SSL)

let socket = null;

// ==============================
// 🔌 CONNECT SOCKET (SAFE)
// ==============================
export const connectSocket = (url = SOCKET_URL) => {
  try {
    // ✅ prevent duplicate connection
    if (socket && socket.connected) {
      console.log("⚠️ Socket already connected");
      return socket;
    }

    // ✅ clean old socket (important)
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    console.log("🚀 Connecting to:", url);

    socket = io(url, {
      transports: ["websocket"], // ✅ BEST for mobile apps
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,

      // ✅ SSL safe config
      secure: url.startsWith("https"),
      rejectUnauthorized: false, // 🔥 important for mobile + self-signed issues

      // ✅ stability
      forceNew: true,
    });

    // ==============================
    // ✅ CONNECTION EVENTS
    // ==============================

    socket.on("connect", () => {
      console.log("🟢 Socket Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔴 Socket Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.log("❌ Connection Error:", err.message);
    });

    socket.io.on("reconnect_attempt", () => {
      console.log("🔄 Reconnecting...");
    });

    socket.io.on("reconnect", () => {
      console.log("✅ Reconnected");
    });

    socket.io.on("reconnect_error", (err) => {
      console.log("❌ Reconnect Error:", err.message);
    });

    // ==============================
    // 📡 REAL-TIME EVENT
    // ==============================

    socket.on("zoneUpdate", (data) => {
      console.log("🔥 LIVE UPDATE:", data);
    });

    return socket;
  } catch (err) {
    console.log("❌ Socket Init Error:", err.message);
    return null;
  }
};

// ==============================
// 🔌 GET SOCKET INSTANCE
// ==============================
export const getSocket = () => {
  if (!socket) {
    console.log("⚠️ Socket not initialized");
  }
  return socket;
};

// ==============================
// 🔌 DISCONNECT SOCKET
// ==============================
export const disconnectSocket = () => {
  try {
    if (socket) {
      socket.removeAllListeners(); // ✅ prevent memory leaks
      socket.disconnect();
      socket = null;
      console.log("🔌 Socket disconnected");
    }
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};