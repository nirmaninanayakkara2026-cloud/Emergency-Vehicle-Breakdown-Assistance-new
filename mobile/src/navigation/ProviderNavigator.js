import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProviderEntryScreen from "../screens/provider/ProviderEntryScreen";
import ProviderDashboardScreen from "../screens/provider/ProviderDashboardScreen";
import ProviderProfileScreen from "../screens/provider/ProviderProfileScreen";
import ProviderRequestDetailsScreen from "../screens/provider/ProviderRequestDetailsScreen";
import SparePartsShopDashboardScreen from "../screens/provider/SparePartsShopDashboardScreen";
import ShopInventoryScreen from "../screens/provider/ShopInventoryScreen";
import SparePartItemFormScreen from "../screens/provider/SparePartItemFormScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { stackScreenOptions } from "./navigationTheme";

const Stack = createNativeStackNavigator();

export default function ProviderNavigator() {
  return (
    <Stack.Navigator
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="ProviderEntry" component={ProviderEntryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProviderProfile" component={ProviderProfileScreen} options={{ title: "Provider Profile" }} />
      <Stack.Screen name="ProviderDashboard" component={ProviderDashboardScreen} options={{ title: "Provider Dashboard" }} />
      <Stack.Screen name="ProviderRequestDetails" component={ProviderRequestDetailsScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="SparePartsShopDashboard" component={SparePartsShopDashboardScreen} options={{ title: "Shop Dashboard" }} />
      <Stack.Screen name="ShopInventory" component={ShopInventoryScreen} options={{ title: "Inventory" }} />
      <Stack.Screen name="SparePartItemForm" component={SparePartItemFormScreen} options={{ title: "Spare Part" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}
