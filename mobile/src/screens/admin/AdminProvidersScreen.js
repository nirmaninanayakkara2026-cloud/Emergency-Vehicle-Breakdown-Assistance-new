import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { getAdminProviders } from "../../services/adminService";
import { adminStyles, approvalTone, titleCase } from "./adminUi";

const statuses = [
  { label: "All", value: "" },
  ...["pending", "approved", "rejected", "suspended"].map((value) => ({
    label: titleCase(value),
    value,
  })),
];
const providerTypes = [
  { label: "All provider types", value: "" },
  { label: "Mechanic", value: "mechanic" },
  { label: "Garage", value: "garage" },
  { label: "Towing Service", value: "towing_service" },
  { label: "Spare Parts Shop", value: "spare_parts_shop" },
];

export default function AdminProvidersScreen({ navigation }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [providerType, setProviderType] = useState("");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminProviders({
        status: status || undefined,
        providerType: providerType || undefined,
        search: search || undefined,
      });
      setProviders(data.providers || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [status, providerType, search]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <ScreenContainer>
      {/* Providers page header and administration context. */}
      <ScreenHeader
        eyebrow="Administration"
        title="Providers"
        subtitle="Approve and manage every provider type, including spare-parts shops."
      />
      {/* Search and provider filtering controls. */}
      <AppCard>
        <AppInput
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Name, email, phone, or business"
        />
        <AppSelect
          label="Provider type"
          options={providerTypes}
          value={providerType}
          onChange={setProviderType}
        />
        <AppSelect
          label="Approval status"
          options={statuses}
          value={status}
          onChange={setStatus}
        />
      </AppCard>
      {/* Feedback shown while loading providers or when loading fails. */}
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {loading ? <LoadingState message="Loading providers..." /> : null}
      {/* Empty state when no providers match the selected filters. */}
      {!loading && !providers.length ? (
        <EmptyState
          title="No providers found"
          message="Try another search or status filter."
          icon="business-outline"
        />
      ) : null}
      {/* Provider results and account status details. */}
      {providers.map((provider) => (
        <AppCard key={provider.providerId}>
          <View style={styles.heading}>
            <Text style={styles.title}>{provider.businessName}</Text>
            <StatusBadge
              label={titleCase(provider.approvalStatus)}
              tone={approvalTone(provider.approvalStatus)}
            />
          </View>
          <Text style={styles.body}>
            {provider.name} · {titleCase(provider.providerType)}
          </Text>
          <Text style={styles.body}>{provider.email || "No email"}</Text>
          <Text style={styles.body}>
            Approval Status: {titleCase(provider.approvalStatus)}
          </Text>
          <Text style={styles.body}>
            Availability: {titleCase(provider.availabilityStatus)}
          </Text>
          <Text style={styles.body}>
            Account: {provider.accountIsActive ? "Active" : "Inactive"}
          </Text>
          <AppButton
            title="View Details"
            variant="secondary"
            compact
            onPress={() =>
              navigation.navigate("AdminProviderDetails", {
                providerId: provider.providerId,
              })
            }
          />
        </AppCard>
      ))}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  ...adminStyles,
  heading: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
});
