import { io } from "socket.io-client";

// ==========================================
// 🌐 SOCKET CONFIG
// ==========================================

const SOCKET_URL = "https://smartvenue-4qvd.onrender.com";

let socket = null;

// ==========================================
// 🔌 CONNECT SOCKET
// ==========================================

export const connectSocket = () => {
  try {
    // Prevent duplicate connection
    if (socket && socket.connected) {
      console.log("⚠️ Socket already connected");
      return socket;
    }

    // Cleanup old socket
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    console.log("🚀 Connecting to socket:", SOCKET_URL);

    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,

      path: "/socket.io",

      forceNew: true,
    });

    // ==========================================
    // CONNECT
    // ==========================================

    socket.on("connect", () => {
      console.log("🟢 Socket connected:", socket.id);
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on("disconnect", (reason) => {
      console.log("🔴 Socket disconnected:", reason);
    });

    // ==========================================
    // CONNECTION ERROR
    // ==========================================

    socket.on("connect_error", (err) => {
      console.log("❌ Socket connection error:", err.message);
    });

    // ==========================================
    // RECONNECT
    // ==========================================

    socket.io.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 Reconnecting... attempt ${attempt}`);
    });

    socket.io.on("reconnect", (attempt) => {
      console.log(`✅ Socket reconnected after ${attempt} attempts`);
    });

    // ==========================================
    // 📡 REAL-TIME ZONE UPDATE
    // ==========================================

    socket.on("zoneUpdate", (data) => {
      try {
        if (!data) return;

        console.log("🔥 LIVE ZONE UPDATE:", data);
      } catch (err) {
        console.log("❌ zoneUpdate error:", err.message);
      }
    });

    return socket;
  } catch (err) {
    console.log("❌ Socket initialization error:", err.message);
    return null;
  }
};

// ==========================================
// 🔌 GET SOCKET
// ==========================================

export const getSocket = () => {
  return socket;
};

// ==========================================
// 🔌 DISCONNECT SOCKET
// ==========================================

export const disconnectSocket = () => {
  try {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;

      console.log("🔌 Socket disconnected");
    }
  } catch (err) {
    console.log("❌ Disconnect error:", err.message);
  }
};