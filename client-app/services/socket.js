// services/socket.js

import { io } from "socket.io-client";

// ==============================
// 🧠 CONFIG
// ==============================

// 👉 Use NGINX URL (no port needed)
// Later replace with domain:
// const SOCKET_URL = "https://yourdomain.com";

const SOCKET_URL = "http://18.214.178.1";

let socket = null;

// ==============================
// 🔌 CONNECT SOCKET
// ==============================
export const connectSocket = (url = SOCKET_URL) => {
  // 🔴 If already connected → return existing
  if (socket?.connected) {
    console.log("⚠️ Socket already connected");
    return socket;
  }

  // 🔴 Clean old socket (important fix)
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  console.log("🚀 Connecting to:", url);

  socket = io(url, {
    transports: ["websocket"], // ✅ required for mobile
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  // ==============================
  // ✅ CONNECTION EVENTS
  // ==============================

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
    console.log("🔥 LIVE UPDATE:", data);
  });

  return socket;
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
  if (socket) {
    socket.removeAllListeners(); // 🔥 prevent memory leaks
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket disconnected");
  }
};