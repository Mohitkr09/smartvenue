// services/socket.js

import { io } from "socket.io-client";

// ==============================
// 🧠 CONFIG (PRODUCTION)
// ==============================

// 👉 Use your domain (AFTER HTTPS)
// fallback to http if SSL not ready yet

const SOCKET_URL =
  __DEV__
    ? "http://18.214.178.1:5000" // local dev
    : "https://smartvenue.online"; // production

let socket = null;

// ==============================
// 🔌 CONNECT SOCKET
// ==============================
export const connectSocket = (url = SOCKET_URL) => {
  // Prevent duplicate connection
  if (socket?.connected) {
    console.log("⚠️ Socket already connected");
    return socket;
  }

  // Clean old instance
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  console.log("🚀 Connecting to:", url);

  socket = io(url, {
    transports: ["websocket"], // ✅ best for mobile
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,

    // 🔥 IMPORTANT for production stability
    secure: url.startsWith("https"),
    forceNew: true,
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
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket disconnected");
  }
};