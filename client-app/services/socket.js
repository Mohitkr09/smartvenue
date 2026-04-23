// services/socket.js

import { io } from "socket.io-client";

// ==============================
// 🧠 CONFIG (FIXED)
// ==============================

// ✅ MUST MATCH YOUR BACKEND
const SOCKET_URL = "http://18.214.178.1:5000";

let socket = null;

// ==============================
// 🔌 CONNECT SOCKET (SAFE)
// ==============================
export const connectSocket = (url = SOCKET_URL) => {
  // prevent duplicate connections
  if (socket && socket.connected) {
    console.log("⚠️ Socket already connected");
    return socket;
  }

  console.log("🚀 Connecting to:", url);

  socket = io(url, {
    transports: ["websocket"], // ✅ IMPORTANT for mobile
    reconnection: true,
    reconnectionAttempts: Infinity, // 🔥 never stop reconnecting
    reconnectionDelay: 2000,
    timeout: 10000,
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
// 🔌 DISCONNECT
// ==============================
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket manually disconnected");
  }
};