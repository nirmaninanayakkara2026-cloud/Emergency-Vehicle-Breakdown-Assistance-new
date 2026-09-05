import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import RequestMechanicScreen from "../screens/driver/RequestMechanicScreen";
import SelfBreakdownAssistantScreen from "../screens/driver/SelfBreakdownAssistantScreen";
import GuidedSymptomCaptureScreen from "../screens/driver/GuidedSymptomCaptureScreen";
import AIClarificationScreen from "../screens/driver/AIClarificationScreen";
import SymptomSummaryScreen from "../screens/driver/SymptomSummaryScreen";
import SelfAssistantSafetyScreen from "../screens/driver/SelfAssistantSafetyScreen";
import TroubleshootingConversationScreen from "../screens/driver/TroubleshootingConversationScreen";
import SelfAssistantResultScreen from "../screens/driver/SelfAssistantResultScreen";
import RecommendationScreen from "../screens/driver/RecommendationScreen";
import RequestTrackingScreen from "../screens/driver/RequestTrackingScreen";
import MyRequestsScreen from "../screens/driver/MyRequestsScreen";
import RequestDetailsScreen from "../screens/driver/RequestDetailsScreen";
import JobCompletionScreen from "../screens/driver/JobCompletionScreen";
import SparePartsFinderScreen from "../screens/driver/SparePartsFinderScreen";
import NearbySparePartsScreen from "../screens/driver/NearbySparePartsScreen";
import SparePartsShopDetailsScreen from "../screens/driver/SparePartsShopDetailsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { stackScreenOptions } from "./navigationTheme";

const Stack = createNativeStackNavigator();

export default function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RequestMechanic" component={RequestMechanicScreen} options={{ title: "Request Help" }} />
      <Stack.Screen name="SelfBreakdownAssistant" component={SelfBreakdownAssistantScreen} options={{ title: "Breakdown Assistant" }} />
      <Stack.Screen name="GuidedSymptomCapture" component={GuidedSymptomCaptureScreen} options={{ title: "Describe the Problem" }} />
      <Stack.Screen name="AIClarification" component={AIClarificationScreen} options={{ title: "A Few Quick Questions" }} />
      <Stack.Screen name="SymptomSummary" component={SymptomSummaryScreen} options={{ title: "Symptom Summary" }} />
      <Stack.Screen name="SelfAssistantSafety" component={SelfAssistantSafetyScreen} options={{ title: "Safety Check" }} />
      <Stack.Screen name="TroubleshootingConversation" component={TroubleshootingConversationScreen} options={{ title: "Safe Guidance" }} />
      <Stack.Screen name="SelfAssistantResult" component={SelfAssistantResultScreen} options={{ title: "Self-Assistant Result" }} />
      <Stack.Screen name="Recommendation" component={RecommendationScreen} options={{ title: "Recommendations" }} />
      <Stack.Screen name="RequestTracking" component={RequestTrackingScreen} options={{ title: "Track Request" }} />
      <Stack.Screen name="MyRequests" component={MyRequestsScreen} options={{ title: "My Requests" }} />
      <Stack.Screen name="RequestDetails" component={RequestDetailsScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="JobCompletion" component={JobCompletionScreen} options={{ title: "Service Completed", gestureEnabled: false, headerBackVisible: false }} />
      <Stack.Screen name="SparePartsFinder" component={SparePartsFinderScreen} options={{ title: "Spare Parts" }} />
      <Stack.Screen name="NearbySpareParts" component={NearbySparePartsScreen} options={{ title: "Find Spare Parts" }} />
      <Stack.Screen name="SparePartsShopDetails" component={SparePartsShopDetailsScreen} options={{ title: "Shop Details" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}
