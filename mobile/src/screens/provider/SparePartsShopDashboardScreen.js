import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { getMyProviderProfile, updateAvailability } from "../../services/providerService";
import { getMySpareParts } from "../../services/sparePartService";
import { colors, radii, spacing, typography } from "../../theme";

const availabilityOptions = [
  { label: "Online", value: "online" }, { label: "Busy", value: "busy" }, { label: "Offline", value: "offline" }
];
const titleCase = (value) => { const text = String(value || "").replaceAll("_", " "); return `${text.charAt(0).toUpperCase()}${text.slice(1)}`; };

export default function SparePartsShopDashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [profileData, inventory] = await Promise.all([getMyProviderProfile(), getMySpareParts()]);
      setProfile(profileData); setItems(inventory.items || []);
    } catch (loadError) {
      if (loadError.message.toLowerCase().includes("profile not found")) return navigation.replace("ProviderProfile");
      setError(loadError.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, [navigation]);

  useEffect(() => { load(); }, [load]);
  async function changeAvailability(value) {
    try { setProfile(await updateAvailability(value)); } catch (updateError) { setError(updateError.message); }
  }
  if (loading) return <ScreenContainer><LoadingState message="Loading shop dashboard..." /></ScreenContainer>;
  const approval = profile?.approvalStatus || "pending";
  const inStock = items.filter((item) => item.isAvailable && item.quantity > 0).length;
  const banner = approval === "approved"
    ? profile?.availabilityStatus === "online"
      ? { tone: "success", title: "Approved", message: "Your shop is approved and visible to nearby drivers." }
      : { tone: "warning", title: "Approved", message: "Your profile is approved, but drivers cannot find you while you are offline." }
    : approval === "rejected"
      ? { tone: "danger", title: "Approval rejected", message: profile?.rejectionReason || "Update your profile and submit it again." }
      : approval === "suspended"
        ? { tone: "danger", title: "Shop suspended", message: profile?.suspensionReason || "Your shop is hidden from drivers." }
        : { tone: "warning", title: "Pending approval", message: "Your shop must be approved before drivers can find it. You can prepare inventory while approval is pending." };

  return <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <ScreenHeader eyebrow={profile?.businessName || "Shop owner workspace"} title="Spare Parts Shop" subtitle="Manage visibility and live inventory." right={<AppButton title="Account" compact variant="ghost" icon="person-outline" onPress={() => navigation.navigate("Profile")} />} />
    {error ? <InfoBanner tone="danger" message={error} /> : null}
    <InfoBanner {...banner} />
    <View style={styles.stats}><Stat icon="cube-outline" value={items.length} label="All items" /><Stat icon="checkmark-circle-outline" value={inStock} label="In stock" /><Stat icon="alert-circle-outline" value={items.length - inStock} label="Unavailable" /></View>
    <AppCard>
      <Text style={styles.body}>Approval: {titleCase(approval)}</Text>
      <Text style={styles.body}>Availability: {titleCase(profile?.availabilityStatus || "offline")}</Text>
      <AppSelect label="Shop availability" options={availabilityOptions} value={profile?.availabilityStatus || "offline"} onChange={changeAvailability} disabled={approval !== "approved"} />
      <Text style={styles.hint}>Only approved shops marked Online are shown to nearby drivers.</Text>
    </AppCard>
    <AppCard>
      <Text style={styles.heading}>Inventory</Text>
      <Text style={styles.body}>Keep quantities current so drivers only see parts that are really in stock.</Text>
      <AppButton title="Manage Inventory" icon="list-outline" onPress={() => navigation.navigate("ShopInventory")} />
      <AppButton title="Add Spare Part" icon="add-circle-outline" variant="secondary" onPress={() => navigation.navigate("SparePartItemForm")} />
    </AppCard>
    <AppButton title={approval === "rejected" ? "Edit & Resubmit Shop Profile" : "Edit Shop Profile"} variant="secondary" onPress={() => navigation.navigate("ProviderProfile", { resubmit: approval === "rejected" })} />
  </ScreenContainer>;
}

function Stat({ icon, value, label }) { return <View style={styles.stat}><Ionicons name={icon} size={23} color={colors.teal} /><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>; }
const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: spacing.xs }, stat: { flex: 1, minHeight: 104, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.tealLight, justifyContent: "space-between" }, value: { ...typography.pageTitle, color: colors.primaryDark }, label: { ...typography.caption, color: colors.textSecondary }, heading: { ...typography.sectionTitle, color: colors.primaryDark }, body: { ...typography.body, color: colors.textSecondary }, hint: { ...typography.caption, color: colors.textSecondary }
});
