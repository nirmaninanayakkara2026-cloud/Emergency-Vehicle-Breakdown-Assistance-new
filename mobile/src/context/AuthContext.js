import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAuthData,
  getCurrentUser,
  getStoredAuthData,
  loginUser,
  registerUser,
  updateProfile
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    try {
      const storedAuth = await getStoredAuthData();

      if (!storedAuth.token) {
        setUser(null);
        setToken(null);
        return;
      }

      setToken(storedAuth.token);
      setUser(storedAuth.user);

      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      await clearAuthData();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      restoreSession,
      login: async (credentials) => {
        const authData = await loginUser(credentials);
        setUser(authData.user);
        setToken(authData.token);
        return authData;
      },
      register: async (details) => {
        const authData = await registerUser(details);
        setUser(authData.user);
        setToken(authData.token);
        return authData;
      },
      logout: async () => {
        await clearAuthData();
        setUser(null);
        setToken(null);
      },
      updateUserProfile: async (details) => {
        const updatedUser = await updateProfile(details);
        setUser(updatedUser);
        return updatedUser;
      }
    }),
    [user, token, loading, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
