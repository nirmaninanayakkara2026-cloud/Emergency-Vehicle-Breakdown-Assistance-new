import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getProviders } from "../../services/providerService";
import { cancelRequest, getRequestById, selectProvider } from "../../services/requestService";
import { COLORS } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function RequestDetailsScreen({ navigation, route }) {
  const [request, setRequest] = useState(route.params?.request || null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(!route.params?.request);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const requestId = route.params?.requestId || request?._id;

  const loadDetails = useCallback(async () => {
    setError("");
    try {
      const [requestData, providerData] = await Promise.all([
        requestId ? getRequestById(requestId) : Promise.resolve(request),
        getProviders()
      ]);
      setRequest(requestData);
      setProviders(providerData);
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

  async function handleSelectProvider(providerId) {
    setActionLoading(true);
    setError("");
    try {
      const updatedRequest = await selectProvider(request._id, providerId);
      setRequest(updatedRequest);
    } catch (selectError) {
      setError(selectError.message);
    } finally {
      setActionLoading(false);
    }
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
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  const selectedProvider = request.selectedProviderId;

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>Request Details</Text>
      {error ? (
        <AppCard>
          <Text style={styles.error}>{error}</Text>
          <AppButton title="Retry" onPress={loadDetails} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.cardTitle}>{request._id}</Text>
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
        <Text style={styles.label}>Status</Text>
        <Text style={styles.status}>{formatValue(request.status)}</Text>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.body}>{request.location?.address}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.body}>{request.problemDescription}</Text>
        {selectedProvider ? (
          <>
            <Text style={styles.label}>Selected provider</Text>
            <Text style={styles.body}>{selectedProvider.businessName || selectedProvider}</Text>
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

      {!selectedProvider && request.status !== "cancelled" ? (
        <AppCard>
          <Text style={styles.cardTitle}>Select Provider</Text>
          {providers.length === 0 ? <Text style={styles.body}>No approved providers available yet.</Text> : null}
          {providers.map((provider) => (
            <AppCard key={provider._id} style={styles.providerCard}>
              <Text style={styles.providerName}>{provider.businessName}</Text>
              <Text style={styles.body}>{formatValue(provider.providerType)} - {provider.availabilityStatus}</Text>
              <Text style={styles.body}>Service radius: {provider.serviceRadiusKm} km</Text>
              <Text style={styles.body}>Price: {provider.estimatedPriceRange?.minimum || 0} - {provider.estimatedPriceRange?.maximum || 0}</Text>
              <AppButton title="Select Provider" onPress={() => handleSelectProvider(provider._id)} loading={actionLoading} />
            </AppCard>
          ))}
        </AppCard>
      ) : null}

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
  providerCard: {
    backgroundColor: COLORS.softSurface
  },
  providerName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
