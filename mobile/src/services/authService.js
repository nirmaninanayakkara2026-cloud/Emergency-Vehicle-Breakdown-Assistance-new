import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { STORAGE_KEYS } from "../utils/constants";

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || "Something went wrong";
}

async function storeAuthData(user, token) {
  if (token) {
    await AsyncStorage.setItem(STORAGE_KEYS.token, token);
  }

  if (user) {
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }
}

export async function registerUser(payload) {
  try {
    const response = await api.post("/auth/register", payload);
    const { user, token } = response.data.data;
    await storeAuthData(user, token);
    return { user, token };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function loginUser(payload) {
  try {
    const response = await api.post("/auth/login", payload);
    const { user, token } = response.data.data;
    await storeAuthData(user, token);
    return { user, token };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getCurrentUser() {
  try {
    const response = await api.get("/auth/me");
    const { user } = response.data.data;
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    return user;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateProfile(payload) {
  try {
    const response = await api.patch("/auth/profile", payload);
    const { user } = response.data.data;
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    return user;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getStoredAuthData() {
  const [token, userValue] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.token),
    AsyncStorage.getItem(STORAGE_KEYS.user)
  ]);

  return {
    token,
    user: userValue ? JSON.parse(userValue) : null
  };
}

export async function clearAuthData() {
  await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
}
