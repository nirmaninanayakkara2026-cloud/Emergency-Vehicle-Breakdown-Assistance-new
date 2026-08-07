import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProviderEntryScreen from "../screens/provider/ProviderEntryScreen";
import ProviderDashboardScreen from "../screens/provider/ProviderDashboardScreen";
import ProviderProfileScreen from "../screens/provider/ProviderProfileScreen";
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
      <Stack.Screen name="ProviderEntry" component={ProviderEntryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProviderProfile" component={ProviderProfileScreen} options={{ title: "Provider Profile" }} />
      <Stack.Screen name="ProviderDashboard" component={ProviderDashboardScreen} options={{ title: "Provider Dashboard" }} />
      <Stack.Screen name="ProviderRequestDetails" component={ProviderRequestDetailsScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}
