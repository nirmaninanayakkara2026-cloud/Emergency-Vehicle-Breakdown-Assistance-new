import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { getMyProviderProfile, updateAvailability } from "../../services/providerService";
import { acceptRequest, getAssignedRequests, rejectRequest } from "../../services/requestService";
import { COLORS } from "../../utils/constants";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDisplayValue, formatFaultLabel, formatRequestStatus, formatServiceType } from "../../utils/displayLabels";

const availabilityOptions = [
  { label: "Online", value: "online" },
  { label: "Busy", value: "busy" },
  { label: "Offline", value: "offline" }
];

function formatValue(value) {
  if (!value) return "Not available";
  const formatted = value.replaceAll("_", " ");
  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
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

  async function handleDecision(requestId, accepted) {
    setUpdatingId(`${requestId}-${accepted ? "accept" : "reject"}`);
    setError("");
    try {
      const updatedRequest = accepted
        ? await acceptRequest(requestId, 30)
        : await rejectRequest(requestId, "Provider is currently unavailable");
      setRequests((currentRequests) =>
        currentRequests.map((request) => (request._id === requestId ? updatedRequest : request))
      );
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setUpdatingId("");
    }
  }

  const approvalStatus = profile?.approvalStatus || "pending";
  const approvalContent = {
    pending: { tone: "warning", title: "Pending Approval", message: "Your profile is under review. You will not appear to drivers yet." },
    approved: { tone: profile?.availabilityStatus === "online" ? "success" : "warning", title: "Approved", message: profile?.availabilityStatus === "online" ? "Your profile is approved and visible to drivers." : "Your profile is approved, but drivers cannot find you while you are offline." },
    rejected: { tone: "danger", title: "Rejected", message: `Your profile was not approved.${profile?.rejectionReason ? ` Reason: ${profile.rejectionReason}` : ""}` },
    suspended: { tone: "danger", title: "Suspended", message: `Your provider account is temporarily suspended.${profile?.suspensionReason ? ` Reason: ${profile.suspensionReason}` : ""}` }
  }[approvalStatus];

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading service dashboard..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <ScreenHeader eyebrow="Provider workspace" title="Service Dashboard" subtitle="Manage requests and keep drivers updated." right={<AppButton title="Profile" icon="person-outline" variant="ghost" compact onPress={() => navigation.navigate("Profile")} />} />
      <View style={styles.summaryRow}><Summary icon="mail-unread-outline" value={requests.filter((item) => item.status === "provider_requested").length} label="Incoming" tone="blue" /><Summary icon="construct-outline" value={requests.filter((item) => ["accepted","provider_en_route","arrived","in_progress"].includes(item.status)).length} label="Active Job" tone="teal" /><Summary icon="checkmark-done-outline" value={requests.filter((item) => item.status === "completed" && new Date(item.updatedAt || item.createdAt).toDateString() === new Date().toDateString()).length} label="Today" tone="green" /></View>

      {error ? (
        <AppCard>
          <ErrorState message="We couldn't load your service dashboard." onRetry={loadDashboard} />
        </AppCard>
      ) : null}

      {profile ? (
        <AppCard>
          <View style={styles.profileTop}><View style={styles.providerIcon}><Ionicons name="business-outline" size={25} color={colors.primary} /></View><View style={styles.profileCopy}><Text style={styles.providerName}>{profile.businessName}</Text><Text style={styles.body}>{formatDisplayValue(profile.providerType)}</Text><Text style={styles.rating}>★ {profile.averageRating} · {profile.totalReviews} reviews · {profile.completedJobs} completed</Text></View></View>
          <AppSelect
            label="Availability"
            options={availabilityOptions}
            value={profile.availabilityStatus}
            onChange={handleAvailability}
            disabled={approvalStatus !== "approved"}
          />
          <Text style={styles.body}>Approval: {formatValue(approvalStatus)}</Text>
          <Text style={styles.body}>Availability: {formatValue(profile.availabilityStatus)}</Text>
          {approvalContent ? <InfoBanner tone={approvalContent.tone} title={approvalContent.title} message={approvalContent.message} /> : null}
          <AppButton title={approvalStatus === "rejected" ? "Edit & Resubmit" : "Edit Provider Profile"} variant="secondary" onPress={() => navigation.navigate("ProviderProfile", { resubmit: approvalStatus === "rejected" })} />
        </AppCard>
      ) : null}

      <SectionHeader title="Incoming Requests" subtitle="Review new and active roadside jobs." />
      {requests.length === 0 ? (
        <AppCard>
          <EmptyState title="No incoming requests" message="New roadside requests will appear here." icon="notifications-outline" />
        </AppCard>
      ) : null}
      {requests.map((request) => (
        <AppCard key={request._id}>
          <View style={styles.cardHeader}>
            <View style={styles.requestIcon}><Ionicons name="car-outline" size={23} color={colors.primary} /></View><Text style={styles.driverName}>{request.driverId?.name || "Driver Request"}</Text>
            <StatusBadge status={request.status} tone={request.urgencyLevel === "high" ? "danger" : "info"} />
          </View>
          <View style={styles.requestMeta}><Meta icon="car-sport-outline" text={formatDisplayValue(request.vehicleType)} /><Meta icon="construct-outline" text={formatServiceType(request.requiredServiceType)} /><Meta icon="alert-circle-outline" text={formatFaultLabel(request.aiPrediction?.predictedFault, request.aiPrediction?.faultLabel || formatDisplayValue(request.breakdownType))} /><Meta icon="location-outline" text={`${request.providerDistanceKm ?? "—"} km · ${request.location?.address || "Location unavailable"}`} /></View>
          <Text style={styles.description}>{request.problemDescription}</Text>
          {request.symptomCapture?.additionalDescription ? (
            <Text style={styles.description}>Symptoms: {request.symptomCapture.additionalDescription}</Text>
          ) : null}
          <AppButton
            title="View Request Details"
            icon="arrow-forward"
            variant="secondary"
            compact
            onPress={() => navigation.navigate("ProviderRequestDetails", { requestId: request._id, request })}
          />
          {request.status === "provider_requested" && approvalStatus === "approved" ? (
            <View style={styles.actions}>
              <AppButton
                title="Accept"
                compact
                variant="success"
                loading={updatingId === `${request._id}-accept`}
                onPress={() => handleDecision(request._id, true)}
              />
              <AppButton
                title="Reject"
                compact
                variant="danger"
                loading={updatingId === `${request._id}-reject`}
                onPress={() => handleDecision(request._id, false)}
              />
            </View>
          ) : null}
        </AppCard>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", gap: spacing.xs },
  summary: { flex: 1, minHeight: 104, borderRadius: radii.md, padding: spacing.sm, justifyContent: "space-between" }, summaryValue: { ...typography.pageTitle, color: colors.primaryDark }, summaryLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  profileTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, providerIcon: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" }, profileCopy: { flex: 1 }, rating: { ...typography.caption, color: colors.textSecondary },
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
  requestIcon: { width: 42, height: 42, borderRadius: radii.sm, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" },
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
  requestMeta: { gap: spacing.xs }, meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, metaText: { ...typography.body, flex: 1, color: colors.textSecondary },
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

function Summary({ icon, value, label, tone }) { const palette = tone === "green" ? [colors.greenLight, colors.green] : tone === "teal" ? [colors.tealLight, colors.teal] : [colors.blueLight, colors.blue]; return <View style={[styles.summary, { backgroundColor: palette[0] }]}><Ionicons name={icon} size={23} color={palette[1]} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }
function Meta({ icon, text }) { return <View style={styles.meta}><Ionicons name={icon} size={18} color={colors.teal} /><Text style={styles.metaText}>{text}</Text></View>; }
