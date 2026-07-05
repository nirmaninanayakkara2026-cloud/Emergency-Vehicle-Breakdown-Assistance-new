import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import RequestMechanicScreen from "../screens/driver/RequestMechanicScreen";
import SelfBreakdownAssistantScreen from "../screens/driver/SelfBreakdownAssistantScreen";
import RecommendationScreen from "../screens/driver/RecommendationScreen";
import RequestTrackingScreen from "../screens/driver/RequestTrackingScreen";
import SparePartsFinderScreen from "../screens/driver/SparePartsFinderScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { COLORS } from "../utils/constants";

const Stack = createNativeStackNavigator();

export default function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.surface,
        headerTitleStyle: { fontWeight: "700" }
      }}
    >
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ title: "Driver Home" }} />
      <Stack.Screen name="RequestMechanic" component={RequestMechanicScreen} options={{ title: "Request Help" }} />
      <Stack.Screen name="SelfBreakdownAssistant" component={SelfBreakdownAssistantScreen} options={{ title: "Breakdown Assistant" }} />
      <Stack.Screen name="Recommendation" component={RecommendationScreen} options={{ title: "Recommendations" }} />
      <Stack.Screen name="RequestTracking" component={RequestTrackingScreen} options={{ title: "Track Request" }} />
      <Stack.Screen name="SparePartsFinder" component={SparePartsFinderScreen} options={{ title: "Spare Parts" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}
