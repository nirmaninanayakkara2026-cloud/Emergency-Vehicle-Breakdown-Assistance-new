import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getRequestById } from "../../services/requestService";
import { COLORS } from "../../utils/constants";

const timeline = ["pending", "recommended", "accepted", "on_the_way", "in_progress", "completed"];

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function RequestTrackingScreen({ navigation, route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [loading, setLoading] = useState(!route.params?.request);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestId = route.params?.requestId || request?._id;

  const loadRequest = useCallback(async () => {
    setError("");

    if (!requestId) {
      setError("Request id is missing.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await getRequestById(requestId);
      setRequest(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadRequest();
  }

  if (loading || !request) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  const activeIndex = timeline.indexOf(request.status);
  const selectedProvider = request.selectedProviderId;

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>Request Tracking</Text>

      {error ? (
        <AppCard>
          <Text style={styles.error}>{error}</Text>
          <AppButton title="Retry" onPress={loadRequest} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.cardTitle}>Status</Text>
        {timeline.map((status, index) => (
          <View key={status} style={styles.timelineRow}>
            <View style={[styles.dot, index <= activeIndex && styles.activeDot]} />
            <Text style={[styles.timelineText, index <= activeIndex && styles.activeText]}>{formatValue(status)}</Text>
          </View>
        ))}
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Request</Text>
        <Text style={styles.label}>Current status</Text>
        <Text style={styles.status}>{formatValue(request.status)}</Text>
        <Text style={styles.label}>Selected provider</Text>
        <Text style={styles.body}>{selectedProvider?.businessName || "No provider selected"}</Text>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.body}>{formatValue(request.vehicleType)}</Text>
        <Text style={styles.label}>Breakdown</Text>
        <Text style={styles.body}>{formatValue(request.breakdownType)}</Text>
        <Text style={styles.label}>Required service</Text>
        <Text style={styles.body}>{formatValue(request.requiredServiceType)}</Text>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.body}>{request.location?.address || "Not available"}</Text>
      </AppCard>

      <AppButton title="Refresh" variant="secondary" onPress={loadRequest} />
      <AppButton title="Back to My Requests" variant="secondary" onPress={() => navigation.navigate("MyRequests")} />
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
    fontWeight: "700",
    textTransform: "capitalize"
  },
  activeText: {
    color: COLORS.text
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
  status: {
    color: COLORS.success,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
