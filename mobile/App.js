// Ensure `window.location` exists for Metro HMR client (fixes
// "Cannot read property 'protocol' of undefined" in Expo/React Native).
if (typeof window === 'undefined') global.window = global;
if (!window.location) window.location = { protocol: 'exp:' };

import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
