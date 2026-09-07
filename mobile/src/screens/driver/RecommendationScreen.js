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
import PredictionSummaryCard from "../../components/PredictionSummaryCard";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  getRequestRecommendations,
  selectProvider,
} from "../../services/requestService";
import { colors, radii, spacing, typography } from "../../theme";
import { formatServiceType } from "../../utils/displayLabels";

export default function RecommendationScreen({ navigation, route }) {
  const requestId = route.params?.requestId;
  const request = route.params?.request;
  const aiPrediction = route.params?.aiPrediction || request?.aiPrediction;
  const [result, setResult] = useState({ providers: [] });
  const [expandedProvider, setExpandedProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState("");
  const [error, setError] = useState("");

  // Load providers ranked for the current breakdown request.
  const loadRecommendations = useCallback(async () => {
    setError("");
    if (!requestId) {
      setError("This request could not be opened.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setResult(await getRequestRecommendations(requestId));
    } catch (recommendationError) {
      setError(recommendationError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Select a provider and continue to request tracking.
  async function handleSelectProvider(providerId) {
    setSelectingId(String(providerId));
    setError("");
    try {
      const updatedRequest = await selectProvider(requestId, providerId);
      navigation.replace("RequestTracking", {
        requestId: updatedRequest._id,
        request: updatedRequest,
      });
    } catch (selectError) {
      setError(selectError.message);
    } finally {
      setSelectingId("");
    }
  }

  if (loading)
    return (
      <ScreenContainer scroll={false}>
        <LoadingState message="Finding suitable mechanics..." />
      </ScreenContainer>
    );
  const providers = result.providers || [];
  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadRecommendations();
          }}
        />
      }
    >
      {/* Recommendation header and AI prediction context. */}
      <ScreenHeader
        eyebrow="Nearby assistance"
        title="Recommended for You"
        subtitle="Based on your symptoms, location, and service availability."
      />
      <PredictionSummaryCard prediction={aiPrediction} />
      {/* Estimated service cost returned with the recommendations. */}
      {result.estimatedCostRange ? (
        <AppCard style={styles.costCard}>
          <View style={styles.costIcon}>
            <Ionicons name="wallet-outline" size={23} color={colors.teal} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.smallLabel}>Estimated Service Range</Text>
            <Text style={styles.cost}>
              {result.estimatedCostRange.currency}{" "}
              {Number(result.estimatedCostRange.min).toLocaleString()} –{" "}
              {Number(result.estimatedCostRange.max).toLocaleString()}
            </Text>
            <Text style={styles.note}>
              Actual cost may vary after inspection.
            </Text>
          </View>
        </AppCard>
      ) : null}
      {/* Fallback explanation and recommendation loading errors. */}
      {result.fallbackUsed ? (
        <InfoBanner
          tone="warning"
          title="General assistance shown"
          message={result.message}
        />
      ) : null}
      {error ? (
        <AppCard>
          <ErrorState
            message="We couldn't load provider recommendations. Please try again."
            onRetry={loadRecommendations}
          />
        </AppCard>
      ) : null}
      {/* Empty state with retry and towing alternatives. */}
      {!error && providers.length === 0 ? (
        <AppCard>
          <EmptyState
            title="No providers found"
            message={
              result.message ||
              "No suitable provider is available nearby right now."
            }
            icon="location-outline"
            actionLabel="Try Again"
            onAction={loadRecommendations}
            secondaryLabel="Request Towing"
            onSecondary={() =>
              navigation.navigate("RequestMechanic", {
                prefill: { ...request, breakdownType: "towing_needed" },
              })
            }
          />
        </AppCard>
      ) : null}
      {/* Ranked provider cards and selection actions. */}
      {providers.map((provider, index) => {
        const providerId = String(provider.providerId);
        const expanded = expandedProvider === providerId;
        return (
          <AppCard
            key={providerId}
            style={index === 0 ? styles.bestCard : undefined}
          >
            <View style={styles.cardTop}>
              <View style={styles.providerIcon}>
                <Ionicons name="construct" size={24} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                {index === 0 ? (
                  <StatusBadge label="Best Match" tone="success" />
                ) : null}
                <Text style={styles.providerName}>
                  {provider.name || provider.businessName}
                </Text>
                <Text style={styles.service}>
                  {formatServiceType(
                    (provider.specializations || [])[0] ||
                      provider.providerType,
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.metaGrid}>
              <Meta
                icon="star"
                text={
                  provider.totalReviews
                    ? `${provider.rating} (${provider.totalReviews} reviews)`
                    : "New provider"
                }
                color={colors.amber}
              />
              <Meta icon="location" text={`${provider.distanceKm} km away`} />
              <Meta
                icon="time"
                text={
                  provider.averageResponseTime == null
                    ? "Response time unavailable"
                    : `Approx. ${provider.averageResponseTime} min response`
                }
              />
              <Meta
                icon="checkmark-circle"
                text="Available now"
                color={colors.green}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpandedProvider(expanded ? "" : providerId)}
              style={styles.whyButton}
            >
              <Text style={styles.whyText}>Why this provider?</Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.teal}
              />
            </Pressable>
            {expanded ? (
              <View style={styles.reasons}>
                {(
                  provider.whyRecommended || [
                    "Matches the required service",
                    "Nearby and available",
                  ]
                ).map((reason) => (
                  <View key={reason} style={styles.reason}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.green}
                    />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
                <View style={styles.reason}>
                  <Ionicons
                    name="navigate-circle"
                    size={18}
                    color={colors.blue}
                  />
                  <Text style={styles.reasonText}>
                    Service radius: {provider.serviceRadiusKm} km
                  </Text>
                </View>
              </View>
            ) : null}
            <AppButton
              title="Select Provider"
              icon="arrow-forward"
              loading={selectingId === providerId}
              onPress={() => handleSelectProvider(provider.providerId)}
            />
          </AppCard>
        );
      })}
    </ScreenContainer>
  );
}

// Reusable icon and text row for provider metadata.
function Meta({ icon, text, color = colors.textSecondary }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  costCard: { flexDirection: "row", alignItems: "center" },
  costIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.tealLight,
    alignItems: "center",
    justifyContent: "center",
  },
  smallLabel: { ...typography.caption, color: colors.textSecondary },
  cost: { ...typography.cardTitle, color: colors.primaryDark },
  note: { ...typography.caption, color: colors.textSecondary },
  bestCard: { borderColor: colors.teal, borderWidth: 1.5 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  providerIcon: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  providerName: { ...typography.sectionTitle, color: colors.textPrimary },
  service: { ...typography.body, color: colors.textSecondary },
  metaGrid: { gap: spacing.sm, paddingVertical: spacing.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { ...typography.body, color: colors.textSecondary },
  whyButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  whyText: { ...typography.bodyStrong, color: colors.teal },
  reasons: {
    gap: spacing.xs,
    backgroundColor: colors.softSurface,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  reason: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  reasonText: { ...typography.body, flex: 1, color: colors.textPrimary },
});
