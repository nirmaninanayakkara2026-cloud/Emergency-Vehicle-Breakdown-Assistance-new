import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { STORAGE_KEYS } from "../utils/constants";

export const API_BASE_URL = "http://192.168.1.2:5050/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.token);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
