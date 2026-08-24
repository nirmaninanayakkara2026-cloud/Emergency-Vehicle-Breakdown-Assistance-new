import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { STORAGE_KEYS } from "../utils/constants";

const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "";

export const API_BASE_URL = configuredApiUrl.replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

api.interceptors.request.use(async (config) => {
  if (!API_BASE_URL) {
    return Promise.reject(new Error("The service connection is not configured."));
  }
  const token = await AsyncStorage.getItem(STORAGE_KEYS.token);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
