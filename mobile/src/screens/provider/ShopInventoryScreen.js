import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { deleteSparePart, getMySpareParts, updateSparePartQuantity } from "../../services/sparePartService";
import { colors, spacing, typography } from "../../theme";

export default function ShopInventoryScreen({ navigation }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [updating, setUpdating] = useState("");
  const load = useCallback(async () => { try { setError(""); const data = await getMySpareParts(); setItems(data.items || []); } catch (e) { setError(e.message); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { const unsubscribe = navigation.addListener("focus", load); return unsubscribe; }, [navigation, load]);
  async function setQuantity(item, quantity) { if (quantity < 0) return; setUpdating(item._id); try { const data = await updateSparePartQuantity(item._id, quantity); setItems((current) => current.map((entry) => entry._id === item._id ? data.item : entry)); } catch (e) { setError(e.message); } finally { setUpdating(""); } }
  function remove(item) { Alert.alert("Delete spare part?", `${item.name} will be removed from your inventory.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await deleteSparePart(item._id); setItems((current) => current.filter((entry) => entry._id !== item._id)); } catch (e) { setError(e.message); } } }]); }
  if (loading) return <ScreenContainer><LoadingState message="Loading inventory..." /></ScreenContainer>;
  return <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <ScreenHeader eyebrow="Shop inventory" title="Spare Parts" subtitle="Update stock quantities as parts are sold or received." right={<AppButton title="Add" compact icon="add" onPress={() => navigation.navigate("SparePartItemForm")} />} />
    {error ? <InfoBanner tone="danger" message={error} /> : null}
    {!items.length ? <AppCard><EmptyState icon="cube-outline" title="No spare parts yet" message="Add your first item to begin building the shop inventory." /><AppButton title="Add Spare Part" onPress={() => navigation.navigate("SparePartItemForm")} /></AppCard> : null}
    {items.map((item) => { const tone = item.quantity === 0 || !item.isAvailable ? "danger" : item.quantity <= 3 ? "warning" : "success"; const status = item.quantity === 0 || !item.isAvailable ? "Out of stock" : item.quantity <= 3 ? "Low stock" : "In stock"; return <AppCard key={item._id}>
      <View style={styles.top}><View style={styles.flex}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{[item.brand, item.partNumber, item.category].filter(Boolean).join(" · ")}</Text></View><StatusBadge status={status} tone={tone} /></View>
      <Text style={styles.price}>Price: {item.price == null ? "Not set" : `LKR ${Number(item.price).toLocaleString()}`}</Text><Text style={styles.quantity}>Stock: {item.quantity}</Text>
      <View style={styles.actions}><AppButton title="−" compact variant="secondary" disabled={item.quantity === 0 || updating === item._id} onPress={() => setQuantity(item, item.quantity - 1)} /><AppButton title="+" compact variant="secondary" loading={updating === item._id} onPress={() => setQuantity(item, item.quantity + 1)} /><AppButton title="Edit" compact variant="ghost" onPress={() => navigation.navigate("SparePartItemForm", { itemId: item._id })} /><AppButton title="Delete" compact variant="danger" onPress={() => remove(item)} /></View>
    </AppCard>; })}
  </ScreenContainer>;
}
const styles = StyleSheet.create({ top: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, flex: { flex: 1 }, name: { ...typography.sectionTitle, color: colors.primaryDark }, meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 }, price: { ...typography.body, color: colors.teal, fontWeight: "700" }, quantity: { ...typography.body, color: colors.textPrimary, fontWeight: "700" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs } });
