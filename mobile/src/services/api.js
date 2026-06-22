import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:5050/api";
const fallbackBaseUrls = [
  configuredBaseUrl,
  "http://10.0.2.2:5050/api",
].filter((url, index, urls) => url && urls.indexOf(url) === index);

const api = axios.create({
  baseURL: configuredBaseUrl,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
    "localtunnel-skip-browser-warning": "true",
  },
});

export const API_BASE_URL = api.defaults.baseURL;

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.message !== "Network Error" || !originalRequest || originalRequest._retriedBaseUrls) {
      return Promise.reject(error);
    }

    originalRequest._retriedBaseUrls = true;
    for (const baseURL of fallbackBaseUrls) {
      if (baseURL === originalRequest.baseURL) continue;
      try {
        return await api.request({ ...originalRequest, baseURL });
      } catch (_retryError) {
        // Try the next development host.
      }
    }

    return Promise.reject(error);
  },
);

export default api;
