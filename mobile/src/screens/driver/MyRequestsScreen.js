import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { getMyRequests } from "../../services/requestService";
import { COLORS } from "../../utils/constants";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatDisplayValue,
  formatFaultLabel,
  formatServiceType,
} from "../../utils/displayLabels";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function MyRequestsScreen({ navigation }) {
  // Store request history, loading state, refresh state, and load errors.
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Load the driver's requests from the backend.
  const loadRequests = useCallback(async () => {
    setError("");
    try {
      const data = await getMyRequests();
      setRequests(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Refresh the request history using pull-to-refresh.
  async function handleRefresh() {
    setRefreshing(true);
    await loadRequests();
  }

  if (loading) {
    return (
      <ScreenContainer>
        {/* Initial request-history loading state. */}
        <LoadingState message="Loading your requests..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Request history header and tracking context. */}
      <ScreenHeader
        eyebrow="Roadside history"
        title="My Requests"
        subtitle="Track active help and review earlier requests."
      />
      {/* Request loading error with retry action. */}
      {error ? (
        <AppCard>
          <ErrorState
            message="We couldn't load your requests."
            onRetry={loadRequests}
          />
        </AppCard>
      ) : null}
      {/* Empty state for drivers without request history. */}
      {!error && requests.length === 0 ? (
        <AppCard>
          <EmptyState
            title="No requests yet"
            message="You don't have a roadside assistance request."
            icon="car-outline"
            actionLabel="Request Mechanic"
            onAction={() => navigation.navigate("RequestMechanic")}
          />
        </AppCard>
      ) : null}
      {/* Request history cards and status-based navigation. */}
      {requests.map((request) => (
        <Pressable
          key={request._id}
          onPress={() =>
            navigation.navigate(
              request.status === "completed"
                ? "JobCompletion"
                : "RequestDetails",
              { requestId: request._id, request },
            )
          }
        >
          <AppCard>
            <View style={styles.cardTop}>
              <View style={styles.icon}>
                <Ionicons
                  name="car-sport-outline"
                  size={23}
                  color={colors.primary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>
                  {formatFaultLabel(
                    request.aiPrediction?.predictedFault,
                    request.aiPrediction?.faultLabel ||
                      formatDisplayValue(request.breakdownType),
                  )}
                </Text>
                <Text style={styles.date}>
                  {new Date(
                    request.completedAt || request.createdAt,
                  ).toLocaleDateString()}
                </Text>
              </View>
              <StatusBadge
                status={request.status}
                tone={
                  request.status === "completed"
                    ? "success"
                    : request.status === "cancelled"
                      ? "neutral"
                      : "info"
                }
              />
            </View>
            <View style={styles.meta}>
              <Text style={styles.body}>
                {request.selectedProviderId?.businessName ||
                  formatDisplayValue(request.vehicleType)}
              </Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.body}>
                {formatServiceType(request.requiredServiceType)}
              </Text>
            </View>
            {request.status === "completed" ? (
              <View style={styles.completedMeta}>
                <Text style={styles.finalPrice}>
                  LKR {Number(request.finalCost || 0).toLocaleString()}
                </Text>
                {request.review ? (
                  <Text style={styles.reviewStars}>
                    {"★".repeat(request.review.rating)}
                    {"☆".repeat(5 - request.review.rating)}
                  </Text>
                ) : (
                  <Text style={styles.date}>Rate This Provider</Text>
                )}
              </View>
            ) : null}
            <View style={styles.open}>
              <Text style={styles.openText}>
                {request.status === "completed"
                  ? "View completed service"
                  : "View details"}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.teal} />
            </View>
          </AppCard>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  date: { ...typography.caption, color: colors.textSecondary },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dot: { color: colors.muted },
  open: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  openText: { ...typography.bodyStrong, color: colors.teal },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21,
    textTransform: "capitalize",
  },
  completedMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  finalPrice: { ...typography.bodyStrong, color: colors.green },
  reviewStars: { color: colors.amber, fontSize: 18 },
  empty: {
    color: COLORS.muted,
    lineHeight: 21,
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20,
  },
});
