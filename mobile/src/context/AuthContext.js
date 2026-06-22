import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getCurrentUser, loginUser, registerUser } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setUser(await getCurrentUser());
      } catch (_error) {
        await AsyncStorage.multiRemove(["authToken", "authUser"]);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const saveSession = async (data) => {
    await AsyncStorage.multiSet([
      ["authToken", data.token],
      ["authUser", JSON.stringify(data.user)],
    ]);
    setUser(data.user);
  };

  const login = async (credentials) => saveSession(await loginUser(credentials));
  const register = async (details) => saveSession(await registerUser(details));
  const logout = async () => {
    await AsyncStorage.multiRemove(["authToken", "authUser"]);
    setUser(null);
  };

  const value = useMemo(() => ({ loading, login, logout, register, user }), [loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
