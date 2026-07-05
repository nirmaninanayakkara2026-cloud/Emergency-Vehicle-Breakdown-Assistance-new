import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProviderDashboardScreen from "../screens/provider/ProviderDashboardScreen";
import ProviderRequestDetailsScreen from "../screens/provider/ProviderRequestDetailsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { COLORS } from "../utils/constants";

const Stack = createNativeStackNavigator();

export default function ProviderNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.surface,
        headerTitleStyle: { fontWeight: "700" }
      }}
    >
      <Stack.Screen name="ProviderDashboard" component={ProviderDashboardScreen} options={{ title: "Provider Dashboard" }} />
      <Stack.Screen name="ProviderRequestDetails" component={ProviderRequestDetailsScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}
