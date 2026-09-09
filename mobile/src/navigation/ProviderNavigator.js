import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

function ProviderProfileBackButton({ navigation }) {
  function handlePress() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // A missing profile is opened with replace(), so there may be no route to
    // pop. Send the provider to their account instead of showing a dead button.
    navigation.replace("Profile");
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      onPress={handlePress}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
    >
      <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
    </Pressable>
  );
}

export default function ProviderNavigator() {
  return (
    <Stack.Navigator
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="ProviderEntry" component={ProviderEntryScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProviderProfile"
        component={ProviderProfileScreen}
        options={({ navigation }) => ({
          title: "Provider Profile",
          headerLeft: () => <ProviderProfileBackButton navigation={navigation} />
        })}
      />
      <Stack.Screen name="ProviderDashboard" component={ProviderDashboardScreen} options={{ title: "Provider Dashboard" }} />
      <Stack.Screen name="ProviderRequestDetails" component={ProviderRequestDetailsScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="SparePartsShopDashboard" component={SparePartsShopDashboardScreen} options={{ title: "Shop Dashboard" }} />
      <Stack.Screen name="ShopInventory" component={ShopInventoryScreen} options={{ title: "Inventory" }} />
      <Stack.Screen name="SparePartItemForm" component={SparePartItemFormScreen} options={{ title: "Spare Part" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    borderRadius: 20
  },
  backButtonPressed: {
    opacity: 0.55
  }
});
