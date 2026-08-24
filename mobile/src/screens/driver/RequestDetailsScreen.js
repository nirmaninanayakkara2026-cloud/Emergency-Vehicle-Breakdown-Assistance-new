import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import PredictionSummaryCard from "../../components/PredictionSummaryCard";
import ScreenContainer from "../../components/ScreenContainer";
import ErrorState from "../../components/ui/ErrorState";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { cancelRequest, getRequestById } from "../../services/requestService";
import { COLORS } from "../../utils/constants";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDisplayValue, formatServiceType } from "../../utils/displayLabels";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function RequestDetailsScreen({ navigation, route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [loading, setLoading] = useState(!route.params?.request);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const requestId = route.params?.requestId || request?._id;

  const loadDetails = useCallback(async () => {
    setError("");
    try {
      const requestData = await (requestId ? getRequestById(requestId) : Promise.resolve(request));
      setRequest(requestData);
    } catch (detailsError) {
      setError(detailsError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadDetails();
  }

  async function handleCancel() {
    setActionLoading(true);
    setError("");
    try {
      const updatedRequest = await cancelRequest(request._id);
      setRequest(updatedRequest);
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !request) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading request details..." />
      </ScreenContainer>
    );
  }

  const selectedProvider = request.selectedProviderId;

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <ScreenHeader eyebrow="Roadside request" title="Request Details" subtitle="Review the assistance details and next actions." right={<StatusBadge status={request.status} tone={request.status === "completed" ? "success" : "info"} />} />
      {error ? (
        <AppCard>
          <ErrorState message="We couldn't load this request." onRetry={loadDetails} />
        </AppCard>
      ) : null}

      <PredictionSummaryCard prediction={request.aiPrediction} />

      {request.aiPrediction?.needsMoreInformation &&
      Number(request.clarificationAttempts || 0) < 1 &&
      request.status !== "cancelled" ? (
        <AppButton
          title="Answer Quick Questions"
          onPress={() =>
            navigation.navigate("AIClarification", {
              requestId: request._id,
              request,
              aiPrediction: request.aiPrediction
            })
          }
        />
      ) : null}

      <AppCard>
        <View style={styles.cardHeader}><View style={styles.icon}><Ionicons name="car-sport-outline" size={24} color={colors.primary} /></View><Text style={styles.cardTitle}>{formatDisplayValue(request.vehicleType)} assistance</Text></View>
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
        <Text style={styles.body}>{formatServiceType(request.requiredServiceType)}</Text>
        <Text style={styles.label}>Urgency</Text>
        <Text style={styles.body}>{formatValue(request.urgencyLevel)}</Text>
        <Text style={styles.label}>Status</Text>
        <StatusBadge status={request.status} tone={request.status === "completed" ? "success" : "info"} />
        <Text style={styles.label}>Location</Text>
        <Text style={styles.body}>{request.location?.address}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.body}>{request.problemDescription}</Text>
        {selectedProvider ? (
          <>
            <Text style={styles.label}>Selected provider</Text>
            <Text style={styles.body}>{selectedProvider.businessName || selectedProvider}</Text>
            <AppButton title="Track Request" onPress={() => navigation.navigate("RequestTracking", { requestId: request._id, request })} />
          </>
        ) : null}
        {!selectedProvider && request.status !== "cancelled" ? (
          <AppButton
            title="View Recommended Providers"
            onPress={() => navigation.navigate("Recommendation", { requestId: request._id })}
          />
        ) : null}
        {request.status !== "completed" && request.status !== "cancelled" ? (
          <AppButton title="Cancel Request" variant="danger" onPress={handleCancel} loading={actionLoading} />
        ) : null}
      </AppCard>

      <AppButton title="Back to My Requests" variant="secondary" onPress={() => navigation.navigate("MyRequests")} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, icon: { width: 46, height: 46, borderRadius: radii.md, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" },
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900"
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
