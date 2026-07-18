import React from "react";
import { StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../utils/constants";

export default function AdminPlaceholderScreen() {
  const { user, logout } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Admin</Text>
      <AppCard>
        <Text style={styles.cardTitle}>Admin placeholder screen</Text>
        <Text style={styles.body}>
          Logged in as {user?.name || "Admin"}. Admin features will be added in a later phase.
        </Text>
        <AppButton title="Logout" variant="danger" onPress={logout} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 26,
    fontWeight: "900"
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21
  }
});
