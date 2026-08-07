import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../utils/constants";

export default function DriverHomeScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Hello, {user?.name || "Driver"}</Text>
        <Text style={styles.subtitle}>Choose a quick action for roadside assistance.</Text>
      </View>

      <AppCard style={styles.mainCard}>
        <Text style={styles.cardTitle}>Emergency Help</Text>
        <AppButton title="Request Mechanic" onPress={() => navigation.navigate("RequestMechanic")} />
        <AppButton
          title="Self Breakdown Assistant"
          onPress={() => navigation.navigate("SelfBreakdownAssistant")}
        />
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Driver Menu</Text>
        <AppButton title="Find Spare Parts" variant="secondary" onPress={() => navigation.navigate("SparePartsFinder")} />
        <AppButton title="My Requests" variant="secondary" onPress={() => navigation.navigate("MyRequests")} />
        <AppButton title="Profile" variant="secondary" onPress={() => navigation.navigate("Profile")} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6
  },
  title: {
    color: COLORS.primaryDark,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 15
  },
  mainCard: {
    borderColor: COLORS.primary
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  }
});
