import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import CreateBreakdownRequestScreen from "../screens/CreateBreakdownRequestScreen";
import DriverHomeScreen from "../screens/DriverHomeScreen";
import LoginScreen from "../screens/LoginScreen";
import MechanicDashboardScreen from "../screens/MechanicDashboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import RecommendationScreen from "../screens/RecommendationScreen";
import RegisterScreen from "../screens/RegisterScreen";
import RequestTrackingScreen from "../screens/RequestTrackingScreen";
import SparePartsDashboardScreen from "../screens/SparePartsDashboardScreen";
import SparePartsFinderScreen from "../screens/SparePartsFinderScreen";
import SplashScreen from "../screens/SplashScreen";

const Stack = createNativeStackNavigator();
const screenOptions = { headerBackTitle: "Back", headerTintColor: "#176B87" };

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
    </Stack.Navigator>
  );
}

function DriverStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ title: "Driver Home" }} />
      <Stack.Screen name="CreateBreakdownRequest" component={CreateBreakdownRequestScreen} options={{ title: "Request Help" }} />
      <Stack.Screen name="Recommendation" component={RecommendationScreen} options={{ title: "Recommendations" }} />
      <Stack.Screen name="RequestTracking" component={RequestTrackingScreen} options={{ title: "Track Request" }} />
      <Stack.Screen name="SparePartsFinder" component={SparePartsFinderScreen} options={{ title: "Find Parts" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function ProviderStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MechanicDashboard" component={MechanicDashboardScreen} options={{ title: "Assigned Requests" }} />
      <Stack.Screen name="RequestTracking" component={RequestTrackingScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function SparePartsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SparePartsDashboard" component={SparePartsDashboardScreen} options={{ title: "Shop Dashboard" }} />
      <Stack.Screen name="SparePartsFinder" component={SparePartsFinderScreen} options={{ title: "Nearby Shops" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { loading, user } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user) return <AuthStack />;
  if (user.role === "driver") return <DriverStack />;
  if (["mechanic", "garage"].includes(user.role)) return <ProviderStack />;
  if (user.role === "spare_parts_shop") return <SparePartsStack />;
  return <AdminStack />;
}
