import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROVIDER_ROLES, STORAGE_KEYS } from "../utils/constants";

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getStoredUser() {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.user);
  return value ? JSON.parse(value) : null;
}

export async function mockLogin({ email, role }) {
  await delay();
  const normalizedRole = role || "driver";
  const user = {
    id: "u-demo",
    name: normalizedRole === "driver" ? "Demo Driver" : "Demo Provider",
    email: email || "demo@example.com",
    phone: normalizedRole === "driver" ? "0771002003" : "0775558899",
    role: normalizedRole,
    isProvider: PROVIDER_ROLES.includes(normalizedRole)
  };

  await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  return user;
}

export async function mockRegister({ name, email, role }) {
  await delay();
  const normalizedRole = role || "driver";
  const user = {
    id: "u-new",
    name: name || "New User",
    email: email || "newuser@example.com",
    phone: "0770000000",
    role: normalizedRole,
    isProvider: PROVIDER_ROLES.includes(normalizedRole)
  };

  await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  return user;
}

export async function logoutUser() {
  await AsyncStorage.removeItem(STORAGE_KEYS.user);
}
