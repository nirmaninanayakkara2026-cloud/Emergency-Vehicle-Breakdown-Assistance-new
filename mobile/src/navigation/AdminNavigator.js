import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminPlaceholderScreen from "../screens/admin/AdminPlaceholderScreen";
import { COLORS } from "../utils/constants";

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.surface,
        headerTitleStyle: { fontWeight: "700" }
      }}
    >
      <Stack.Screen name="AdminHome" component={AdminPlaceholderScreen} options={{ title: "Admin" }} />
    </Stack.Navigator>
  );
}
