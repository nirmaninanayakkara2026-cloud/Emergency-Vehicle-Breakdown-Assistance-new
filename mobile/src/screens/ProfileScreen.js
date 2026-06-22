import { StyleSheet, Text } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F4F7FB", card: "#FFFFFF", primary: "#176B87", text: "#17324D",
  muted: "#66788A", border: "#D8E1E8", danger: "#C73E3E",
};

export default function ProfileScreen() {
  const { logout, user } = useAuth();
  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Profile" subtitle="Your authenticated account information." colors={SCREEN_COLORS} />
      <AppCard colors={SCREEN_COLORS}>
        <Text style={[styles.name, { color: SCREEN_COLORS.text }]}>{user.name}</Text>
        <Text style={{ color: SCREEN_COLORS.muted }}>{user.email}</Text>
        <Text style={{ color: SCREEN_COLORS.muted }}>{user.phone}</Text>
        <Text style={{ color: SCREEN_COLORS.text }}>Role: {user.role.replaceAll("_", " ")}</Text>
      </AppCard>
      <AppButton title="Logout" variant="danger" onPress={logout} colors={SCREEN_COLORS} />
    </Screen>
  );
}

const styles = StyleSheet.create({ name: { fontSize: 22, fontWeight: "800", marginBottom: 6 } });
