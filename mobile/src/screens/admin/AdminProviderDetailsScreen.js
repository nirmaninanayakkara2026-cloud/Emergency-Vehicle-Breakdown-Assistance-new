import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  approveAdminProvider,
  getAdminProvider,
  reactivateAdminProvider,
  rejectAdminProvider,
  suspendAdminProvider,
} from "../../services/adminService";
import { adminStyles, approvalTone, formatDate, titleCase } from "./adminUi";

export default function AdminProviderDetailsScreen({ route }) {
  const providerId = route.params?.providerId;
  const [provider, setProvider] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminProvider(providerId);
      setProvider(data.provider);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    load();
  }, [load]);
  async function act(action) {
    if (["reject", "suspend"].includes(action) && !reason.trim()) {
      setError(`${titleCase(action)} reason is required.`);
      return;
    }
    setWorking(action);
    setError("");
    setMessage("");
    try {
      if (action === "approve") await approveAdminProvider(providerId);
      if (action === "reject")
        await rejectAdminProvider(providerId, reason.trim());
      if (action === "suspend")
        await suspendAdminProvider(providerId, reason.trim());
      if (action === "reactivate") await reactivateAdminProvider(providerId);
      setReason("");
      setMessage(`Provider ${action} action completed.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking("");
    }
  }
  if (loading)
    return (
      <ScreenContainer>
        {/* Loading state while provider details are fetched. */}
        <LoadingState message="Loading provider details..." />
      </ScreenContainer>
    );
  if (!provider)
    return (
      <ScreenContainer>
        {/* Error state when the provider cannot be found. */}
        <InfoBanner tone="danger" message={error || "Provider not found"} />
      </ScreenContainer>
    );
  const profile = provider.profile || {};
  const account = provider.account || {};
  const location = profile.location;
  const validLocation =
    Number.isFinite(Number(location?.latitude)) &&
    Number.isFinite(Number(location?.longitude));
  return (
    <ScreenContainer>
      {/* Provider page header and review context. */}
      <ScreenHeader
        eyebrow="Provider review"
        title={profile.businessName || provider.businessName}
        subtitle="Account, service, approval, and availability are shown separately."
      />
      {message ? <InfoBanner tone="success" message={message} /> : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}

      {/* Provider Information */}
      <AppCard>
        <View style={styles.heading}>
          <Text style={styles.title}>{account.name || provider.name}</Text>
          <StatusBadge
            label={titleCase(profile.approvalStatus)}
            tone={approvalTone(profile.approvalStatus)}
          />
        </View>
        <Text style={styles.body}>{account.email}</Text>
        <Text style={styles.body}>{account.phone || provider.phone}</Text>
        <Text style={styles.body}>
          Approval Status: {titleCase(profile.approvalStatus)}
        </Text>
        <Text style={styles.body}>
          Availability: {titleCase(profile.availabilityStatus)}
        </Text>
        <Text style={styles.body}>
          Account: {account.isActive ? "Active" : "Inactive"}
        </Text>
        <Text style={styles.body}>
          Provider type: {titleCase(profile.providerType)}
        </Text>
        <Text style={styles.body}>
          Submitted: {formatDate(profile.createdAt)}
        </Text>
      </AppCard>

      {/* shop owner details */}
      <AppCard>
        <Text style={styles.title}>
          {profile.providerType === "spare_parts_shop"
            ? "Shop Profile"
            : "Service Profile"}
        </Text>
        {profile.providerType === "spare_parts_shop" ? (
          <>
            <Text style={styles.body}>
              Inventory items: {profile.inventoryItemCount || 0}
            </Text>
            <Text style={styles.body}>
              Description: {profile.description || "Not provided"}
            </Text>
            <Text style={styles.body}>
              Opening hours: {profile.openingHours || "Not provided"}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Specializations:{" "}
              {(profile.specializations || []).map(titleCase).join(", ") ||
                "None"}
            </Text>
            <Text style={styles.body}>
              Completed jobs: {profile.completedJobs || 0}
            </Text>
            <Text style={styles.body}>
              Service radius: {profile.serviceRadiusKm} km
            </Text>
          </>
        )}
        <Text style={styles.body}>
          Availability: {titleCase(profile.availabilityStatus)}
        </Text>
        <Text style={styles.body}>
          Rating: {profile.averageRating || 0} ({profile.totalReviews || 0}{" "}
          reviews)
        </Text>
        <Text style={styles.body}>
          Location: {location?.address || "Not provided"}
        </Text>
        {validLocation ? (
          <MapView
            style={styles.map}
            scrollEnabled={false}
            zoomEnabled={false}
            initialRegion={{
              latitude: Number(location.latitude),
              longitude: Number(location.longitude),
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              coordinate={{
                latitude: Number(location.latitude),
                longitude: Number(location.longitude),
              }}
            />
          </MapView>
        ) : null}
      </AppCard>
      {/* Reasons recorded for rejected or suspended providers. */}
      {profile.rejectionReason ? (
        <InfoBanner
          tone="danger"
          title="Rejection reason"
          message={profile.rejectionReason}
        />
      ) : null}
      {profile.suspensionReason ? (
        <InfoBanner
          tone="danger"
          title="Suspension reason"
          message={profile.suspensionReason}
        />
      ) : null}
      {/* Administrative controls for changing provider approval status. */}
      <AppCard>
        <Text style={styles.title}>Admin Action</Text>
        {["pending", "approved"].includes(profile.approvalStatus) ? (
          <AppInput
            label="Reason required for reject or suspend"
            value={reason}
            onChangeText={setReason}
            multiline
          />
        ) : null}
        <View style={styles.actions}>
          {["pending", "rejected"].includes(profile.approvalStatus) ? (
            <AppButton
              title="Approve"
              compact
              variant="success"
              loading={working === "approve"}
              onPress={() => act("approve")}
            />
          ) : null}
          {profile.approvalStatus === "pending" ? (
            <AppButton
              title="Reject"
              compact
              variant="danger"
              loading={working === "reject"}
              onPress={() => act("reject")}
            />
          ) : null}
          {profile.approvalStatus === "approved" ? (
            <AppButton
              title="Suspend"
              compact
              variant="danger"
              loading={working === "suspend"}
              onPress={() => act("suspend")}
            />
          ) : null}
          {profile.approvalStatus === "suspended" ? (
            <AppButton
              title="Reactivate"
              compact
              variant="success"
              loading={working === "reactivate"}
              onPress={() => act("reactivate")}
            />
          ) : null}
        </View>
      </AppCard>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  ...adminStyles,
  heading: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  map: { height: 180, borderRadius: 14 },
});
