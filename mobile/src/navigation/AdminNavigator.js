import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminProvidersScreen from "../screens/admin/AdminProvidersScreen";
import AdminProviderDetailsScreen from "../screens/admin/AdminProviderDetailsScreen";
import AdminUsersScreen from "../screens/admin/AdminUsersScreen";
import AdminRequestsScreen from "../screens/admin/AdminRequestsScreen";
import AdminReviewsScreen from "../screens/admin/AdminReviewsScreen";
import { stackScreenOptions } from "./navigationTheme";

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="AdminHome" component={AdminDashboardScreen} options={{ title: "Admin" }} />
      <Stack.Screen name="AdminProviders" component={AdminProvidersScreen} options={{ title: "Providers" }} />
      <Stack.Screen name="AdminProviderDetails" component={AdminProviderDetailsScreen} options={{ title: "Provider Review" }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Users" }} />
      <Stack.Screen name="AdminRequests" component={AdminRequestsScreen} options={{ title: "Requests" }} />
      <Stack.Screen name="AdminReviews" component={AdminReviewsScreen} options={{ title: "Reviews" }} />
    </Stack.Navigator>
  );
}
