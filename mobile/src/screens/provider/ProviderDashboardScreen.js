import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import { getMyProviderProfile, updateAvailability } from "../../services/providerService";
import { getAssignedRequests, updateRequestStatus } from "../../services/requestService";
import { COLORS, REQUEST_STATUS_OPTIONS } from "../../utils/constants";

const availabilityOptions = [
  { label: "Online", value: "available" },
  { label: "Busy", value: "busy" },
  { label: "Offline", value: "offline" }
];

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function ProviderDashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const [profileData, requestData] = await Promise.all([
        getMyProviderProfile(),
        getAssignedRequests()
      ]);
      setProfile(profileData);
      setRequests(requestData);
    } catch (dashboardError) {
      if (dashboardError.message.toLowerCase().includes("profile not found")) {
        navigation.replace("ProviderProfile");
        return;
      }
      setError(dashboardError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard();
  }

  async function handleAvailability(nextStatus) {
    setError("");
    try {
      const updatedProfile = await updateAvailability(nextStatus);
      setProfile(updatedProfile);
    } catch (availabilityError) {
      setError(availabilityError.message);
    }
  }

  async function handleStatusUpdate(requestId, status) {
    setUpdatingId(`${requestId}-${status}`);
    setError("");
    try {
      const updatedRequest = await updateRequestStatus(requestId, status);
      setRequests((currentRequests) =>
        currentRequests.map((request) => (request._id === requestId ? updatedRequest : request))
      );
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setUpdatingId("");
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
      <View style={styles.header}>
        <Text style={styles.title}>Provider Dashboard</Text>
        <AppButton title="Profile" variant="secondary" compact onPress={() => navigation.navigate("Profile")} />
      </View>

      {error ? (
        <AppCard>
          <Text style={styles.error}>{error}</Text>
          <AppButton title="Retry" onPress={loadDashboard} />
        </AppCard>
      ) : null}

      {profile ? (
        <AppCard>
          <Text style={styles.providerName}>{profile.businessName}</Text>
          <Text style={styles.body}>Type: {formatValue(profile.providerType)}</Text>
          <Text style={styles.body}>Rating: {profile.averageRating} ({profile.totalReviews} reviews)</Text>
          <Text style={styles.body}>Completed jobs: {profile.completedJobs}</Text>
          <AppSelect
            label="Availability"
            options={availabilityOptions}
            value={profile.availabilityStatus}
            onChange={handleAvailability}
          />
          <AppButton title="Edit Provider Profile" variant="secondary" onPress={() => navigation.navigate("ProviderProfile")} />
        </AppCard>
      ) : null}

      <Text style={styles.sectionTitle}>Assigned Requests</Text>
      {requests.length === 0 ? (
        <AppCard>
          <Text style={styles.body}>No assigned breakdown requests yet.</Text>
        </AppCard>
      ) : null}
      {requests.map((request) => (
        <AppCard key={request._id}>
          <View style={styles.cardHeader}>
            <Text style={styles.driverName}>{request.driverId?.name || "Driver"}</Text>
            <Text style={styles.status}>{formatValue(request.status)}</Text>
          </View>
          <Text style={styles.body}>Vehicle: {formatValue(request.vehicleType)}</Text>
          <Text style={styles.body}>Breakdown: {formatValue(request.breakdownType)}</Text>
          <Text style={styles.body}>Required service: {formatValue(request.requiredServiceType)}</Text>
          <Text style={styles.body}>Urgency: {formatValue(request.urgencyLevel)}</Text>
          <Text style={styles.body}>Location: {request.location?.address || "Not available"}</Text>
          <Text style={styles.description}>{request.problemDescription}</Text>
          <AppButton
            title="View Details"
            variant="secondary"
            compact
            onPress={() => navigation.navigate("ProviderRequestDetails", { requestId: request._id, request })}
          />
          <View style={styles.actions}>
            {REQUEST_STATUS_OPTIONS.map((option) => (
              <AppButton
                key={option.value}
                title={option.label}
                compact
                variant={option.value === "completed" ? "success" : "secondary"}
                loading={updatingId === `${request._id}-${option.value}`}
                onPress={() => handleStatusUpdate(request._id, option.value)}
              />
            ))}
          </View>
        </AppCard>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  title: {
    flex: 1,
    color: COLORS.primaryDark,
    fontSize: 26,
    fontWeight: "900"
  },
  providerName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  driverName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  status: {
    color: COLORS.primaryDark,
    fontWeight: "900"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21,
    textTransform: "capitalize"
  },
  description: {
    color: COLORS.text,
    lineHeight: 21
  },
  actions: {
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
