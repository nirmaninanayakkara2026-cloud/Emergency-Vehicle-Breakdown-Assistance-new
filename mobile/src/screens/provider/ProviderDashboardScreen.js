import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { getProviderProfile, getProviderRequests } from "../../services/providerService";
import { COLORS } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function ProviderDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    async function loadProviderData() {
      const [profileData, requestData] = await Promise.all([
        getProviderProfile(),
        getProviderRequests()
      ]);
      setProfile(profileData);
      setRequests(requestData);
      setLoading(false);
    }

    loadProviderData();
  }, []);

  function updateRequestStatus(requestId, status) {
    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status } : request
      )
    );
    Alert.alert("Request updated", `Status changed to ${status}.`);
  }

  if (loading || !profile) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Provider Dashboard</Text>
        <AppButton title="Profile" variant="secondary" compact onPress={() => navigation.navigate("Profile")} />
      </View>

      <AppCard>
        <View style={styles.summaryTop}>
          <View style={styles.summaryText}>
            <Text style={styles.providerName}>{profile.name || user?.name}</Text>
            <Text style={styles.providerType}>{formatValue(profile.type || user?.role)}</Text>
          </View>
          <Pressable
            onPress={() => setIsOnline((current) => !current)}
            style={[styles.toggle, isOnline ? styles.online : styles.offline]}
          >
            <Text style={styles.toggleText}>{isOnline ? "Online" : "Offline"}</Text>
          </Pressable>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.completedJobs}</Text>
            <Text style={styles.statLabel}>Completed jobs</Text>
          </View>
        </View>
      </AppCard>

      <Text style={styles.sectionTitle}>Incoming Requests</Text>
      {requests.map((request) => (
        <AppCard key={request.id}>
          <View style={styles.cardHeader}>
            <Text style={styles.driverName}>{request.driverName}</Text>
            <Text style={styles.status}>{request.status}</Text>
          </View>
          <Text style={styles.body}>Vehicle: {formatValue(request.vehicleType)}</Text>
          <Text style={styles.body}>Breakdown: {formatValue(request.breakdownType)}</Text>
          <Text style={styles.body}>Urgency: {formatValue(request.urgencyLevel)}</Text>
          <Text style={styles.body}>Distance: {request.distanceKm} km</Text>
          <Text style={styles.description}>{request.problemDescription}</Text>
          <View style={styles.actions}>
            <AppButton
              title="View Details"
              variant="secondary"
              compact
              onPress={() => navigation.navigate("ProviderRequestDetails", { request })}
            />
            <AppButton
              title="Accept"
              variant="success"
              compact
              onPress={() => updateRequestStatus(request.id, "Accepted")}
            />
            <AppButton
              title="Reject"
              variant="danger"
              compact
              onPress={() => updateRequestStatus(request.id, "Rejected")}
            />
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
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  summaryText: {
    flex: 1,
    gap: 4
  },
  providerName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  providerType: {
    color: COLORS.muted,
    fontSize: 15,
    textTransform: "capitalize"
  },
  toggle: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  online: {
    backgroundColor: COLORS.success
  },
  offline: {
    backgroundColor: COLORS.muted
  },
  toggleText: {
    color: COLORS.surface,
    fontWeight: "800"
  },
  statsRow: {
    flexDirection: "row",
    gap: 12
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.softSurface,
    borderRadius: 8,
    padding: 12
  },
  statNumber: {
    color: COLORS.primaryDark,
    fontSize: 22,
    fontWeight: "900"
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "700"
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
  }
});
