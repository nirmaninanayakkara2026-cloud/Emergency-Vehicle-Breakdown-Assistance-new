import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import {
  approveAdminProvider,
  getAdminDashboard,
  getAdminProviders,
} from "../../services/adminService";
import { adminStyles, approvalTone, formatDate, titleCase } from "./adminUi";

export default function AdminDashboardScreen({ navigation }) {
  //user authentication context for logout and user info
  const { logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboard, providers] = await Promise.all([
        getAdminDashboard(),
        getAdminProviders({ status: "pending" }),
      ]);
      setStats(dashboard);
      setPending(providers.providers || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  //approve a provider and reload the dashboard
  async function approve(providerId) {
    setWorkingId(providerId);
    try {
      await approveAdminProvider(providerId);
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setWorkingId("");
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading admin dashboard..." />
      </ScreenContainer>
    );
  }

  const cards = [
    ["Pending Providers", stats?.pendingProviders],
    ["Approved Providers", stats?.approvedProviders],
    ["Active Requests", stats?.activeBreakdownRequests],
    ["Completed Today", stats?.completedToday],
    ["Drivers", stats?.totalDrivers],
    ["Spare Parts Shops", stats?.sparePartsShops],
  ];
  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      {/* page title */}
      <ScreenHeader
        eyebrow="Administration"
        title="Admin Dashboard"
        subtitle="Review providers and monitor the assistance network."
        right={
          <AppButton
            title="Sign Out"
            compact
            variant="ghost"
            onPress={logout}
          />
        }
      />
      {error ? (
        <AppCard>
          <ErrorState message={error} onRetry={load} />
        </AppCard>
      ) : null}
      {/* card showing statistics */}
      <View style={styles.grid}>
        {cards.map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statValue}>{value ?? 0}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.menu}>
        <AppButton
          title="Providers"
          variant="secondary"
          onPress={() => navigation.navigate("AdminProviders")}
        />
        <AppButton
          title="Users"
          variant="secondary"
          onPress={() => navigation.navigate("AdminUsers")}
        />
        <AppButton
          title="Requests"
          variant="secondary"
          onPress={() => navigation.navigate("AdminRequests")}
        />
        <AppButton
          title="Reviews"
          variant="secondary"
          onPress={() => navigation.navigate("AdminReviews")}
        />
      </View>
      <SectionHeader
        title="Pending Approvals"
        subtitle="Providers remain hidden until an administrator approves them."
      />
      {!pending.length ? (
        <AppCard>
          <EmptyState
            title="No pending approvals"
            message="New provider submissions will appear here."
            icon="checkmark-done-outline"
          />
        </AppCard>
      ) : null}
      {/* provider details */}
      {pending.slice(0, 6).map((provider) => (
        <AppCard key={provider.providerId}>
          <View style={styles.heading}>
            <Text style={styles.title}>{provider.businessName}</Text>
            <StatusBadge
              label={titleCase(provider.approvalStatus)}
              tone={approvalTone(provider.approvalStatus)}
            />
          </View>
          <Text style={styles.body}>{titleCase(provider.providerType)}</Text>
          <Text style={styles.body}>
            {(provider.specializations || []).map(titleCase).join(" · ") ||
              "No specialization listed"}
          </Text>
          <Text style={styles.body}>
            Location: {provider.location?.address || "Not provided"}
          </Text>
          <Text style={styles.body}>
            Submitted: {formatDate(provider.createdAt)}
          </Text>
          <View style={styles.actions}>
            <AppButton
              title="Review"
              compact
              variant="secondary"
              onPress={() =>
                navigation.navigate("AdminProviderDetails", {
                  providerId: provider.providerId,
                })
              }
            />
            <AppButton
              title="Approve"
              compact
              variant="success"
              loading={workingId === provider.providerId}
              onPress={() => approve(provider.providerId)}
            />
            <AppButton
              title="Reject"
              compact
              variant="danger"
              onPress={() =>
                navigation.navigate("AdminProviderDetails", {
                  providerId: provider.providerId,
                  focusReason: true,
                })
              }
            />
          </View>
        </AppCard>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ...adminStyles,
  menu: { gap: 10 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
});
