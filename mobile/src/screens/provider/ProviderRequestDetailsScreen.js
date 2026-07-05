import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getProviderRequestById } from "../../services/providerService";
import { COLORS, MOCK_LOCATION } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function ProviderRequestDetailsScreen({ route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [status, setStatus] = useState(route.params?.request?.status || "Pending");

  useEffect(() => {
    if (!request) {
      getProviderRequestById(route.params?.requestId).then((data) => {
        setRequest(data);
        setStatus(data.status);
      });
    }
  }, [request, route.params?.requestId]);

  function updateStatus(nextStatus) {
    setStatus(nextStatus);
    Alert.alert("Status updated", `Request status is now ${nextStatus}.`);
  }

  if (!request) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  const location = request.currentLocation || {
    ...MOCK_LOCATION,
    address: request.location || MOCK_LOCATION.address
  };

  return (
    <ScreenContainer>
      <AppCard>
        <View style={styles.header}>
          <Text style={styles.title}>{request.id}</Text>
          <Text style={styles.status}>{status}</Text>
        </View>

        <Text style={styles.label}>Driver name</Text>
        <Text style={styles.body}>{request.driverName}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.body}>{request.driverPhone || "0771002003"}</Text>
        <Text style={styles.label}>Vehicle type</Text>
        <Text style={styles.body}>{formatValue(request.vehicleType)}</Text>
        {request.vehicleModel ? (
          <>
            <Text style={styles.label}>Vehicle model</Text>
            <Text style={styles.body}>{request.vehicleModel}</Text>
          </>
        ) : null}
        <Text style={styles.label}>Breakdown type</Text>
        <Text style={styles.body}>{formatValue(request.breakdownType)}</Text>
        <Text style={styles.label}>Urgency</Text>
        <Text style={styles.body}>{formatValue(request.urgencyLevel)}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.body}>{request.problemDescription || "No description provided."}</Text>
        <Text style={styles.label}>Location address</Text>
        <Text style={styles.body}>{location.address}</Text>
        <Text style={styles.label}>Current status</Text>
        <Text style={styles.body}>{status}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Update Status</Text>
        <View style={styles.buttonGrid}>
          <AppButton title="Accepted" variant="success" compact onPress={() => updateStatus("Accepted")} />
          <AppButton title="On the way" variant="secondary" compact onPress={() => updateStatus("On the way")} />
          <AppButton title="In progress" variant="secondary" compact onPress={() => updateStatus("In progress")} />
          <AppButton title="Completed" compact onPress={() => updateStatus("Completed")} />
        </View>
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    flex: 1,
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  status: {
    color: COLORS.surface,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "800"
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  label: {
    color: COLORS.primaryDark,
    fontWeight: "800"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21,
    textTransform: "capitalize"
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});
