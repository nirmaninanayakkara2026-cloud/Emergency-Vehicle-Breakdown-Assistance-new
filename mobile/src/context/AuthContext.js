import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getStoredUser, logoutUser, mockLogin, mockRegister } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const storedUser = await getStoredUser();
        setUser(storedUser);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (credentials) => {
        const loggedInUser = await mockLogin(credentials);
        setUser(loggedInUser);
      },
      register: async (details) => {
        const registeredUser = await mockRegister(details);
        setUser(registeredUser);
      },
      logout: async () => {
        await logoutUser();
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
