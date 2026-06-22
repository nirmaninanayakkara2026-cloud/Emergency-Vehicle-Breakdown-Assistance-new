import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { getRequest } from "../services/breakdownService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#EFF8F6", card: "#FFFFFF", primary: "#16806A", text: "#173E37",
  muted: "#647B76", border: "#D3E7E2", danger: "#C73E3E", success: "#16806A",
};

export default function RequestTrackingScreen({ route, navigation }) {
  const { requestId } = route.params;
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => getRequest(requestId).then(setItem).catch((requestError) => setError(getErrorMessage(requestError))), [requestId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Request tracking" subtitle="Refreshes automatically every 10 seconds." colors={SCREEN_COLORS} />
      <Message colors={SCREEN_COLORS}>{error}</Message>
      {item ? (
        <AppCard colors={SCREEN_COLORS}>
          <Text style={[styles.status, { color: SCREEN_COLORS.success }]}>{item.status.replaceAll("_", " ")}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Vehicle: {item.vehicleType} {item.vehicleModel}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Problem: {item.breakdownType}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Urgency: {item.urgencyLevel}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>AI service: {item.predictedServiceType}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Provider: {item.selectedProviderId?.name || "Waiting for selection"}</Text>
          <Text style={{ color: SCREEN_COLORS.muted }}>Location: {item.location.address}</Text>
        </AppCard>
      ) : <Text style={{ color: SCREEN_COLORS.muted }}>Loading request...</Text>}
      <AppButton title="Refresh now" onPress={load} colors={SCREEN_COLORS} />
      {item?.status === "recommended" && !item.selectedProviderId ? (
        <AppButton title="View recommendations" variant="secondary" onPress={() => navigation.navigate("Recommendation", { requestId })} colors={SCREEN_COLORS} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ status: { fontSize: 24, fontWeight: "800", marginBottom: 12, textTransform: "capitalize" } });
