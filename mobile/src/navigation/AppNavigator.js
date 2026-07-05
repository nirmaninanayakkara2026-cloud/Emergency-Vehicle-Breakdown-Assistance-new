import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import AuthNavigator from "./AuthNavigator";
import DriverNavigator from "./DriverNavigator";
import ProviderNavigator from "./ProviderNavigator";
import { COLORS } from "../utils/constants";

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={COLORS.surface} />
      <Text style={styles.splashText}>Breakdown Assist</Text>
    </View>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {!user ? <AuthNavigator /> : user.isProvider ? <ProviderNavigator /> : <DriverNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: COLORS.primary
  },
  splashText: {
    color: COLORS.surface,
    fontSize: 22,
    fontWeight: "800"
  }
});
