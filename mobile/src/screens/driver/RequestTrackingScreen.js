import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getCurrentRequest } from "../../services/requestService";
import { COLORS, MOCK_LOCATION } from "../../utils/constants";

const timeline = ["Pending", "Accepted", "On the way", "In progress", "Completed"];

export default function RequestTrackingScreen({ route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [loading, setLoading] = useState(!route.params?.request);
  const currentStatus = request?.status || "Pending";
  const activeIndex = Math.max(0, timeline.indexOf(currentStatus));

  useEffect(() => {
    if (!request) {
      getCurrentRequest().then(setRequest).finally(() => setLoading(false));
    }
  }, [request]);

  if (loading || !request) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  const location = request.currentLocation || {
    address: request.location || MOCK_LOCATION.address,
    latitude: MOCK_LOCATION.latitude,
    longitude: MOCK_LOCATION.longitude
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>My Request</Text>

      <AppCard>
        <Text style={styles.cardTitle}>Status Timeline</Text>
        {timeline.map((status, index) => (
          <View key={status} style={styles.timelineRow}>
            <View style={[styles.dot, index <= activeIndex && styles.activeDot]} />
            <Text style={[styles.timelineText, index <= activeIndex && styles.activeText]}>{status}</Text>
          </View>
        ))}
      </AppCard>

      <AppCard>
        <Text style={styles.requestId}>{request.id}</Text>
        <Text style={styles.label}>Selected provider</Text>
        <Text style={styles.body}>{request.providerName || "City Auto Mechanics"}</Text>
        <Text style={styles.label}>Provider phone</Text>
        <Text style={styles.body}>{request.providerPhone || request.provider?.phone || "0771234567"}</Text>
        <Text style={styles.label}>Vehicle type</Text>
        <Text style={styles.body}>{request.vehicleType}</Text>
        <Text style={styles.label}>Breakdown type</Text>
        <Text style={styles.body}>{request.breakdownType || request.issue || "flat_tyre"}</Text>
        <Text style={styles.label}>Urgency</Text>
        <Text style={styles.body}>{request.urgencyLevel || "medium"}</Text>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.body}>
          {location.address} ({location.latitude}, {location.longitude})
        </Text>
      </AppCard>

      <AppCard>
        <AppButton title="Call Provider" onPress={() => Alert.alert("Call Provider", "Mock phone call action.")} />
        <AppButton title="Chat" variant="secondary" onPress={() => Alert.alert("Chat", "Mock chat action.")} />
        <AppButton
          title="Mark as Completed"
          variant="secondary"
          onPress={() => Alert.alert("Completed", "Request marked as completed in mock UI.")}
        />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border
  },
  activeDot: {
    backgroundColor: COLORS.primary
  },
  timelineText: {
    color: COLORS.muted,
    fontWeight: "700"
  },
  activeText: {
    color: COLORS.text
  },
  requestId: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  label: {
    color: COLORS.primaryDark,
    fontWeight: "800"
  },
  body: {
    color: COLORS.muted,
    textTransform: "capitalize"
  }
});
