import { io } from "socket.io-client";

// ==============================
// 🌐 SOCKET CONFIG (FINAL)
// ==============================

// ✅ ALWAYS use HTTPS domain
const SOCKET_URL = "https://smartvenue.online";

let socket = null;

// ==============================
// 🔌 CONNECT SOCKET (SAFE)
// ==============================
export const connectSocket = () => {
  try {
    // prevent duplicate connection
    if (socket && socket.connected) {
      console.log("⚠️ Socket already connected");
      return socket;
    }
    // cleanup old socket
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    console.log("🚀 Connecting to socket:", SOCKET_URL);

    socket = io(SOCKET_URL, {
      transports: ["websocket"], // mobile safe
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,

      // ✅ IMPORTANT FIX
      path: "/socket.io", // must match backend

      forceNew: true,
    });


    socket.on("connect", () => {
      console.log("🟢 Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔴 Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.log("❌ Socket Error:", err.message);
    });

    socket.io.on("reconnect_attempt", () => {
      console.log("🔄 Reconnecting...");
    });

    socket.io.on("reconnect", () => {
      console.log("✅ Reconnected");
    });

    // ==============================
    // 📡 REAL-TIME EVENT
    // ==============================

    socket.on("zoneUpdate", (data) => {
      try {
        if (!data) return;
        console.log("🔥 LIVE UPDATE:", data);
      } catch (err) {
        console.log("❌ zoneUpdate error:", err.message);
      }
    });

    return socket;
  } catch (err) {
    console.log("❌ Socket Init Error:", err.message);
    return null;
  }
};

// ==============================
// 🔌 GET SOCKET
// ==============================
export const getSocket = () => {
  return socket;
};

// ==============================
// 🔌 DISCONNECT SOCKET
// ==============================
export const disconnectSocket = () => {
  try {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
      console.log("🔌 Socket disconnected");
    }
  } catch (err) {
    console.log("❌ Disconnect Error:", err.message);
  }
};