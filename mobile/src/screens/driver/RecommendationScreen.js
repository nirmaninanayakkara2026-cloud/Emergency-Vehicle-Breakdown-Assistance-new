import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getRequestRecommendations, selectProvider } from "../../services/requestService";
import { COLORS } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function RecommendationScreen({ navigation, route }) {
  const requestId = route.params?.requestId;
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState("");
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    setError("");

    if (!requestId) {
      setError("Request id is missing.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await getRequestRecommendations(requestId);
      setRecommendations(data);
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

  async function handleRefresh() {
    setRefreshing(true);
    await loadRecommendations();
  }

  async function handleSelectProvider(providerId) {
    setSelectingId(providerId);
    setError("");
    try {
      const request = await selectProvider(requestId, providerId);
      navigation.replace("RequestTracking", { requestId: request._id, request });
    } catch (selectError) {
      setError(selectError.message);
    } finally {
      setSelectingId("");
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>Recommended Providers</Text>

      {error ? (
        <AppCard>
          <Text style={styles.error}>{error}</Text>
          <AppButton title="Retry" onPress={loadRecommendations} />
        </AppCard>
      ) : null}

      {!error && recommendations.length === 0 ? (
        <AppCard>
          <Text style={styles.body}>No matching available providers found for this request.</Text>
        </AppCard>
      ) : null}

      {recommendations.map((provider) => (
        <AppCard key={provider.providerId}>
          <Text style={styles.cardTitle}>{provider.businessName}</Text>
          <Text style={styles.body}>Provider type: {formatValue(provider.providerType)}</Text>
          <Text style={styles.body}>Specialization: {(provider.specializations || []).join(", ")}</Text>
          <Text style={styles.body}>Distance: {provider.distanceKm} km</Text>
          <Text style={styles.body}>Rating: {provider.rating || 0}</Text>
          <Text style={styles.body}>Expected response: {provider.responseTimeMinutes || "Not available"} min</Text>
          <Text style={styles.body}>
            Estimated cost: {provider.estimatedPriceRange?.minimum || 0} - {provider.estimatedPriceRange?.maximum || 0}
          </Text>
          <Text style={styles.score}>Recommendation score: {provider.recommendationScore}</Text>
          <Text style={styles.body}>Availability: {formatValue(provider.availability)}</Text>
          <AppButton
            title="Select Provider"
            onPress={() => handleSelectProvider(provider.providerId)}
            loading={selectingId === provider.providerId}
          />
        </AppCard>
      ))}
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
  body: {
    color: COLORS.muted,
    lineHeight: 21,
    textTransform: "capitalize"
  },
  score: {
    color: COLORS.primaryDark,
    fontWeight: "900"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
