import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import ErrorState from "../../components/ui/ErrorState";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { acceptRequest, getRequestById, rejectRequest, updateRequestStatus } from "../../services/requestService";
import { COLORS } from "../../utils/constants";
import { formatSymptomKey, formatSymptomValue } from "../../utils/symptomDisplay";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDisplayValue, formatFaultLabel, formatRequestStatus, formatServiceType } from "../../utils/displayLabels";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

function hasSymptomDetails(capture) {
  if (!capture || typeof capture !== "object") return false;
  if (Object.keys(capture.symptoms || {}).length) return true;
  if (Object.values(capture.observedSymptoms || {}).some((values) => Array.isArray(values) && values.length)) {
    return true;
  }
  return Boolean(capture.additionalDescription);
}

function SymptomRow({ label, value }) {
  return (
    <View style={styles.symptomRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{formatSymptomValue(value)}</Text>
    </View>
  );
}

const NEXT_STATUS = {
  accepted: { value: "provider_en_route", label: "Start Journey" },
  provider_en_route: { value: "arrived", label: "Mark Arrived" },
  on_the_way: { value: "arrived", label: "Mark Arrived" },
  arrived: { value: "in_progress", label: "Start Repair" },
  in_progress: { value: "completed", label: "Complete Job" }
};

export default function ProviderRequestDetailsScreen({ route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [loading, setLoading] = useState(!route.params?.request);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState("");
  const [error, setError] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("30");
  const [rejectionReason, setRejectionReason] = useState("");
  const [finalCost, setFinalCost] = useState("");
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
      const updatedRequest = await updateRequestStatus(
        request._id,
        status,
        status === "completed" && finalCost ? Number(finalCost) : undefined
      );
      setRequest(updatedRequest);
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setUpdatingStatus("");
    }
  }

  async function handleAccept() {
    setUpdatingStatus("accept");
    setError("");
    try {
      setRequest(await acceptRequest(request._id, Number(estimatedArrival)));
    } catch (acceptError) {
      setError(acceptError.message);
    } finally {
      setUpdatingStatus("");
    }
  }

  async function handleReject() {
    setUpdatingStatus("reject");
    setError("");
    try {
      setRequest(await rejectRequest(request._id, rejectionReason));
    } catch (rejectError) {
      setError(rejectError.message);
    } finally {
      setUpdatingStatus("");
    }
  }

  if (loading || !request) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading driver request..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <ScreenHeader eyebrow="Active service job" title="Driver Request" subtitle="Review the vehicle, location, and important symptoms." right={<StatusBadge status={request.status} tone={request.urgencyLevel === "high" ? "danger" : "info"} />} />
      {error ? <AppCard><ErrorState message="We couldn't update this request." onRetry={loadRequest} /></AppCard> : null}
      <AppCard>
        <View style={styles.driverHeader}><View style={styles.driverIcon}><Ionicons name="person" size={24} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.title}>{request.driverId?.name || "Driver"}</Text><Text style={styles.body}>{request.driverId?.phone || "Phone unavailable"}</Text></View></View>

        <SectionHeader title="Vehicle and problem" />
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
        <Text style={styles.label}>Possible problem</Text>
        <Text style={styles.body}>{formatFaultLabel(request.aiPrediction?.predictedFault, request.aiPrediction?.faultLabel || "Inspection required")}</Text>
        <Text style={styles.label}>Urgency</Text>
        <Text style={styles.body}>{formatValue(request.urgencyLevel)}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.body}>{request.problemDescription || "Not provided"}</Text>
        <Text style={styles.label}>Location address</Text>
        <Text style={styles.body}>{request.location?.address || "Not available"}</Text>
        <Text style={styles.label}>Distance</Text>
        <Text style={styles.body}>{request.providerDistanceKm ?? "Not available"} km</Text>
        {request.estimatedCostRange ? (
          <>
            <Text style={styles.label}>Estimated service range</Text>
            <Text style={styles.body}>{request.estimatedCostRange.currency} {request.estimatedCostRange.min} - {request.estimatedCostRange.max}</Text>
            <Text style={styles.note}>Actual cost may vary after inspection.</Text>
          </>
        ) : null}
      </AppCard>

      <AppCard>
        <SectionHeader title="Important Symptoms" subtitle="Observations shared by the driver." />
        {hasSymptomDetails(request.symptomCapture) ? (
          <>
            {Object.entries(request.symptomCapture.symptoms || {}).map(([key, value]) => (
              <SymptomRow key={key} label={formatSymptomKey(key)} value={value} />
            ))}
            <SymptomRow label="Seen" value={request.symptomCapture.observedSymptoms?.see || []} />
            <SymptomRow label="Heard" value={request.symptomCapture.observedSymptoms?.hear || []} />
            <SymptomRow label="Smelled" value={request.symptomCapture.observedSymptoms?.smell || []} />
            <SymptomRow label="Felt" value={request.symptomCapture.observedSymptoms?.feel || []} />
            <SymptomRow
              label="Additional description"
              value={request.symptomCapture.additionalDescription}
            />
          </>
        ) : (
          <Text style={styles.body}>No additional symptom details provided.</Text>
        )}
      </AppCard>

      <AppCard>
        <SectionHeader title="Update Job" subtitle="Only the next valid status action is shown." />
        {request.status === "provider_requested" ? (
          <>
            <AppInput label="Estimated arrival (minutes)" value={estimatedArrival} onChangeText={setEstimatedArrival} keyboardType="numeric" />
            <AppButton
              title="Accept Request"
              variant="success"
              loading={updatingStatus === "accept"}
              onPress={handleAccept}
            />
            <AppInput label="Reason for rejection (optional)" value={rejectionReason} onChangeText={setRejectionReason} multiline />
            <AppButton title="Reject Request" variant="danger" loading={updatingStatus === "reject"} onPress={handleReject} />
          </>
        ) : null}
        {request.status === "in_progress" ? (
          <AppInput label="Final cost (optional)" value={finalCost} onChangeText={setFinalCost} keyboardType="numeric" />
        ) : null}
        {NEXT_STATUS[request.status] ? (
          <AppButton
            title={NEXT_STATUS[request.status].value === "provider_en_route" ? "Mark as On the Way" : NEXT_STATUS[request.status].label}
            variant={NEXT_STATUS[request.status].value === "completed" ? "success" : "secondary"}
            loading={updatingStatus === NEXT_STATUS[request.status].value}
            onPress={() => handleUpdateStatus(NEXT_STATUS[request.status].value)}
          />
        ) : null}
        {request.status === "completed" ? <Text style={styles.success}>Job completed.</Text> : null}
        {request.status === "provider_rejected" ? <Text style={styles.body}>This request was returned to the driver for another provider selection.</Text> : null}
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
  flex: { flex: 1 }, driverHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, driverIcon: { width: 50, height: 50, borderRadius: radii.md, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" },
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
  note: { color: COLORS.muted, fontSize: 12, fontStyle: "italic" },
  success: { color: COLORS.success, fontWeight: "900" },
  symptomRow: {
    gap: 3,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
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
