import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getMyRequests } from "../../services/requestService";
import { COLORS } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function MyRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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

  async function handleRefresh() {
    setRefreshing(true);
    await loadRequests();
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
      <Text style={styles.title}>My Requests</Text>
      {error ? (
        <AppCard>
          <Text style={styles.error}>{error}</Text>
          <AppButton title="Retry" onPress={loadRequests} />
        </AppCard>
      ) : null}
      {!error && requests.length === 0 ? (
        <AppCard>
          <Text style={styles.empty}>No breakdown requests yet.</Text>
          <AppButton title="Create Request" onPress={() => navigation.navigate("RequestMechanic")} />
        </AppCard>
      ) : null}
      {requests.map((request) => (
        <Pressable key={request._id} onPress={() => navigation.navigate("RequestDetails", { requestId: request._id })}>
          <AppCard>
            <Text style={styles.cardTitle}>{formatValue(request.vehicleType)}</Text>
            <Text style={styles.body}>Breakdown: {formatValue(request.breakdownType)}</Text>
            <Text style={styles.body}>Required service: {formatValue(request.requiredServiceType)}</Text>
            <Text style={styles.body}>Status: {formatValue(request.status)}</Text>
            <Text style={styles.body}>Urgency: {formatValue(request.urgencyLevel)}</Text>
            <Text style={styles.body}>Date: {new Date(request.createdAt).toLocaleString()}</Text>
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
    fontWeight: "900"
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21,
    textTransform: "capitalize"
  },
  empty: {
    color: COLORS.muted,
    lineHeight: 21
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
