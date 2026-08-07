import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getRequestById, updateRequestStatus } from "../../services/requestService";
import { COLORS, REQUEST_STATUS_OPTIONS } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function ProviderRequestDetailsScreen({ route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [loading, setLoading] = useState(!route.params?.request);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState("");
  const [error, setError] = useState("");
  const requestId = route.params?.requestId || request?._id;

  const loadRequest = useCallback(async () => {
    setError("");
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

  async function handleUpdateStatus(status) {
    setUpdatingStatus(status);
    setError("");
    try {
      const updatedRequest = await updateRequestStatus(request._id, status);
      setRequest(updatedRequest);
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setUpdatingStatus("");
    }
  }

  if (loading || !request) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <AppCard>
        <View style={styles.header}>
          <Text style={styles.title}>{request._id}</Text>
          <Text style={styles.status}>{formatValue(request.status)}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Driver name</Text>
        <Text style={styles.body}>{request.driverId?.name || "Not available"}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.body}>{request.driverId?.phone || "Not available"}</Text>
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
        <Text style={styles.label}>Required service type</Text>
        <Text style={styles.body}>{formatValue(request.requiredServiceType)}</Text>
        <Text style={styles.label}>Urgency</Text>
        <Text style={styles.body}>{formatValue(request.urgencyLevel)}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.body}>{request.problemDescription}</Text>
        <Text style={styles.label}>Location address</Text>
        <Text style={styles.body}>{request.location?.address || "Not available"}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Update Status</Text>
        <View style={styles.buttonGrid}>
          {REQUEST_STATUS_OPTIONS.map((option) => (
            <AppButton
              key={option.value}
              title={option.label}
              compact
              variant={option.value === "completed" ? "success" : "secondary"}
              loading={updatingStatus === option.value}
              onPress={() => handleUpdateStatus(option.value)}
            />
          ))}
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
    fontSize: 18,
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
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
