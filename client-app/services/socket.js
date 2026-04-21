// services/socket.js

import { io } from "socket.io-client";

const SOCKET_URL = "http://34.233.135.146:5001"; // ✅ EC2 PUBLIC IP

let socket;

export const connectSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    // ✅ Connected
    socket.on("connect", () => {
      console.log("🟢 Connected:", socket.id);
    });

    // ❌ Disconnected
    socket.on("disconnect", (reason) => {
      console.log("🔴 Disconnected:", reason);
    });

    // ❌ Error
    socket.on("connect_error", (err) => {
      console.log("❌ Socket Error:", err.message);
    });

    // 🔄 Reconnect
    socket.io.on("reconnect_attempt", () => {
      console.log("🔄 Reconnecting...");
    });
  }
};

export const getSocket = () => socket;