import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { getMyRequests } from "../services/breakdownService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F3F7FA", card: "#FFFFFF", primary: "#176B87", text: "#17324D",
  muted: "#66788A", border: "#D8E1E8", danger: "#C73E3E", success: "#23845D",
};

export default function DriverHomeScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRequests(await getMyRequests()); } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Need roadside help?" subtitle="Create a request or check your recent assistance jobs." colors={SCREEN_COLORS} />
      <AppButton title="Create breakdown request" onPress={() => navigation.navigate("CreateBreakdownRequest")} colors={SCREEN_COLORS} />
      <AppButton title="Find spare parts" variant="secondary" onPress={() => navigation.navigate("SparePartsFinder")} colors={SCREEN_COLORS} />
      <AppButton title="My profile" variant="secondary" onPress={() => navigation.navigate("Profile")} colors={SCREEN_COLORS} />
      <View style={styles.section}><Text style={[styles.heading, { color: SCREEN_COLORS.text }]}>Recent requests</Text></View>
      <Message colors={SCREEN_COLORS}>{error}</Message>
      {requests.length === 0 && !loading ? <Text style={{ color: SCREEN_COLORS.muted }}>No requests yet.</Text> : null}
      {requests.map((item) => (
        <AppCard key={item._id} colors={SCREEN_COLORS}>
          <Text style={[styles.cardTitle, { color: SCREEN_COLORS.text }]}>{item.vehicleType} - {item.breakdownType}</Text>
          <Text style={{ color: SCREEN_COLORS.muted }}>Status: {item.status.replaceAll("_", " ")}</Text>
          <Text style={{ color: SCREEN_COLORS.muted }}>Service: {item.predictedServiceType || "Pending"}</Text>
          <AppButton title="View request" variant="secondary" onPress={() => navigation.navigate("RequestTracking", { requestId: item._id })} colors={SCREEN_COLORS} />
        </AppCard>
      ))}
      <AppButton title="Refresh requests" variant="secondary" loading={loading} onPress={load} colors={SCREEN_COLORS} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: "800" },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6, textTransform: "capitalize" },
});
