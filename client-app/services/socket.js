// services/socket.js

import { io } from "socket.io-client";

const SOCKET_URL = "http://34.233.135.146:5001"; // ✅ EC2 public URL

let socket = null;

// ==============================
// 🔌 CONNECT SOCKET (SAFE)
// ==============================
export const connectSocket = () => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket"], // faster & avoids polling issues
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
    forceNew: true, // ensures fresh connection
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
  // 📡 REAL-TIME EVENT (IMPORTANT)
  // ==============================

  socket.on("zoneUpdate", (data) => {
    console.log("📊 LIVE UPDATE:", data);
  });

  return socket;
};

// ==============================
// 🔌 GET SOCKET INSTANCE
// ==============================
export const getSocket = () => socket;

// ==============================
// 🔌 DISCONNECT (OPTIONAL)
// ==============================
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket manually disconnected");
  }
};