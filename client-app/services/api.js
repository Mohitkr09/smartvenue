import axios from "axios";

const API_URL = "https://smartvenue-4qvd.onrender.com";

// ==========================================
// AXIOS INSTANCE
// ==========================================

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==========================================
// AUTH TOKEN
// ==========================================

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

// ==========================================
// AUTH
// ==========================================

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

// ==========================================
// USER PROFILE
// ==========================================

export const getProfile = async () => {
  const response = await api.get("/user/profile");
  return response.data;
};

export const updateProfile = async (userData) => {
  const response = await api.put("/user/profile", userData);
  return response.data;
};

// ==========================================
// ZONES
// ==========================================

export const getZones = async () => {
  const response = await api.get("/zones");
  return response.data;
};

export const getZone = async (name) => {
  const response = await api.get(
    `/zones/${encodeURIComponent(name)}`
  );

  return response.data;
};

// ==========================================
// ROUTE
// ==========================================

export const getRoute = async (origin, destination) => {
  const response = await api.post("/route", {
    origin,
    destination,
  });

  return response.data;
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default api;