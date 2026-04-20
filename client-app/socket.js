// services/socket.js

import { io } from "socket.io-client";

const SOCKET_URL = "http://172.20.39.19:5000";

// 🔌 Create socket instance
export const socket = io(SOCKET_URL, {
  transports: ["websocket"], // faster & stable
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 10000,
});

// ✅ Connection events
socket.on("connect", () => {
  console.log("🟢 Connected to server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔴 Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.log("❌ Socket Error:", err.message);
});

// 🔄 Optional: auto reconnect log
socket.io.on("reconnect_attempt", () => {
  console.log("🔄 Reconnecting...");
});