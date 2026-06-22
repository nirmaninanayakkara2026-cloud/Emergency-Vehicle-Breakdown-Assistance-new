import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { getAssignedRequests, respondToRequest, updateRequestStatus } from "../services/breakdownService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F6F3EE", card: "#FFFFFF", primary: "#8A5A2B", text: "#43301E",
  muted: "#7B6E61", border: "#E4D9CC", danger: "#B84040", success: "#2B7A52",
};

export default function MechanicDashboardScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const load = useCallback(async () => {
    try { setRequests(await getAssignedRequests()); } catch (requestError) { setError(getErrorMessage(requestError)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (item, action) => {
    setWorkingId(`${item._id}-${action}`);
    setError("");
    try {
      if (["accepted", "rejected"].includes(action)) await respondToRequest(item._id, action);
      else await updateRequestStatus(item._id, action);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setWorkingId(""); }
  };

  const actionsFor = (status) => {
    if (status === "recommended") return ["accepted", "rejected"];
    if (status === "accepted") return ["on_the_way"];
    if (status === "on_the_way") return ["in_progress"];
    if (status === "in_progress") return ["completed"];
    return [];
  };

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Assigned requests" subtitle="Accept a job, then update its progress as you work." colors={SCREEN_COLORS} />
      <AppButton title="My profile" variant="secondary" onPress={() => navigation.navigate("Profile")} colors={SCREEN_COLORS} />
      <Message colors={SCREEN_COLORS}>{error}</Message>
      {requests.length === 0 ? <Text style={{ color: SCREEN_COLORS.muted, marginTop: 20 }}>No assigned requests.</Text> : null}
      {requests.map((item) => (
        <AppCard key={item._id} colors={SCREEN_COLORS}>
          <Text style={[styles.title, { color: SCREEN_COLORS.text }]}>{item.vehicleType} - {item.breakdownType}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Driver: {item.driverId?.name || "Driver"}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Location: {item.location.address}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Urgency: {item.urgencyLevel}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Problem: {item.problemDescription}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>AI service: {item.predictedServiceType}</Text>
          <Text style={{ color: SCREEN_COLORS.success }}>Status: {item.status.replaceAll("_", " ")}</Text>
          <View style={styles.actions}>
            {actionsFor(item.status).map((action) => (
              <View key={action} style={styles.action}>
                <AppButton
                  title={action.replaceAll("_", " ")}
                  variant={action === "rejected" ? "danger" : "primary"}
                  loading={workingId === `${item._id}-${action}`}
                  onPress={() => act(item, action)}
                  colors={SCREEN_COLORS}
                />
              </View>
            ))}
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8, textTransform: "capitalize" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minWidth: 130 },
});
