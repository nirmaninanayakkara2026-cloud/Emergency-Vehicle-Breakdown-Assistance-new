import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { getAdminCounts } from "../services/adminService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F3F3F6", card: "#FFFFFF", primary: "#4E5566", text: "#292D38",
  muted: "#707581", border: "#DDDDE3", danger: "#C73E3E", success: "#23845D",
};

export default function AdminDashboardScreen({ navigation }) {
  const [counts, setCounts] = useState({ users: 0, requests: 0, mechanics: 0, garages: 0, sparePartsShops: 0 });
  const [error, setError] = useState("");
  const load = useCallback(() => getAdminCounts().then(setCounts).catch((requestError) => setError(getErrorMessage(requestError))), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cards = [
    ["Total users", counts.users], ["Total requests", counts.requests],
    ["Mechanics", counts.mechanics], ["Garages", counts.garages],
    ["Spare parts shops", counts.sparePartsShops],
  ];

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="System overview" subtitle="Basic administration counts from protected APIs." colors={SCREEN_COLORS} />
      <Message colors={SCREEN_COLORS}>{error}</Message>
      <View style={styles.grid}>
        {cards.map(([label, count]) => (
          <AppCard key={label} colors={SCREEN_COLORS} style={styles.card}>
            <Text style={[styles.count, { color: SCREEN_COLORS.primary }]}>{count}</Text>
            <Text style={{ color: SCREEN_COLORS.text }}>{label}</Text>
          </AppCard>
        ))}
      </View>
      <AppButton title="Refresh counts" onPress={load} colors={SCREEN_COLORS} />
      <AppButton title="My profile" variant="secondary" onPress={() => navigation.navigate("Profile")} colors={SCREEN_COLORS} />
    </Screen>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, card: { minWidth: "45%", flexGrow: 1 }, count: { fontSize: 30, fontWeight: "800" } });
