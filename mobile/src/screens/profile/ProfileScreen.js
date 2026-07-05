import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../utils/constants";

function formatRole(role) {
  return role ? role.replaceAll("_", " ") : "driver";
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Mock account details for the Phase 1 mobile demo.</Text>
      </View>

      <AppCard>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.body}>{user?.name || "Demo User"}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.body}>{user?.phone || "0770000000"}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.body}>{user?.email || "demo@example.com"}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.body}>{formatRole(user?.role)}</Text>
      </AppCard>

      <AppButton title="Logout" variant="danger" onPress={logout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6
  },
  title: {
    color: COLORS.primaryDark,
    fontSize: 26,
    fontWeight: "900"
  },
  subtitle: {
    color: COLORS.muted,
    lineHeight: 21
  },
  label: {
    color: COLORS.primaryDark,
    fontWeight: "800"
  },
  body: {
    color: COLORS.text,
    fontSize: 16,
    textTransform: "capitalize"
  }
});
