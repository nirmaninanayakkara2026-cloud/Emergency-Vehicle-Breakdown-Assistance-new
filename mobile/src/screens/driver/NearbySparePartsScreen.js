import React, { useCallback, useEffect, useState } from "react";
import { Linking, RefreshControl, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
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
import { getNearbySparePartShops, searchNearbySpareParts } from "../../services/sparePartService";
import { colors, spacing, typography } from "../../theme";

const radii = [{ label: "5 km", value: 5 }, { label: "10 km", value: 10 }, { label: "20 km", value: 20 }, { label: "50 km", value: 50 }];
export default function NearbySparePartsScreen({ navigation, route }) {
  const [mode, setMode] = useState(route.params?.mode || "nearby"); const [term, setTerm] = useState(""); const [radius, setRadius] = useState(10); const [location, setLocation] = useState(null); const [shops, setShops] = useState([]); const [loading, setLoading] = useState(true); const [searched, setSearched] = useState(false); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const locate = useCallback(async () => { const permission = await Location.requestForegroundPermissionsAsync(); if (permission.status !== "granted") throw new Error("Location permission is required to find nearby spare-parts shops."); const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); const point = { latitude: result.coords.latitude, longitude: result.coords.longitude }; setLocation(point); return point; }, []);
  const run = useCallback(async (point = location, nextRadius = radius, nextMode = mode) => { if (nextMode === "search" && !term.trim()) { setError("Enter a part name, brand, category, or part number."); setLoading(false); return; } setError(""); setLoading(true); try { const current = point || await locate(); const params = { ...current, radius: nextRadius }; const data = nextMode === "search" ? await searchNearbySpareParts({ ...params, item: term.trim() }) : await getNearbySparePartShops(params); setShops(data.shops || []); setSearched(true); } catch (e) { setError(e.message); } finally { setLoading(false); setRefreshing(false); } }, [location, radius, mode, term, locate]);
  useEffect(() => { locate().then((point) => { if (mode === "nearby") run(point); else setLoading(false); }).catch((e) => { setError(e.message); setLoading(false); }); }, []);
  function increaseRadius() { const next = radius < 10 ? 10 : radius < 20 ? 20 : 50; setRadius(next); run(location, next); }
  if (loading && !searched) return <ScreenContainer><LoadingState message="Finding nearby shops..." /></ScreenContainer>;
  return <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); run(); }} />}>
    <ScreenHeader eyebrow="Live shop inventory" title={mode === "search" ? "Search Spare Parts" : "Nearby Shops"} subtitle="Only approved, active, online shops are included." />
    <AppCard>{mode === "search" ? <AppInput label="What part do you need?" value={term} onChangeText={setTerm} placeholder="Battery, Bosch, BP-123..." returnKeyType="search" onSubmitEditing={() => run()} /> : null}<AppSelect label="Search radius" options={radii} value={radius} onChange={(value) => { setRadius(value); if (mode === "nearby") run(location, value); }} /><AppButton title={mode === "search" ? "Search" : "Refresh Nearby Shops"} icon="search-outline" onPress={() => run()} /></AppCard>
    {error ? <InfoBanner tone="danger" message={error} /> : null}
    {searched && !shops.length ? <AppCard><EmptyState icon="search-outline" title={mode === "search" ? "We couldn't find this item in stock nearby." : "No online shops nearby"} message="Try a wider search area or a different search term." />{radius < 50 ? <AppButton title="Increase Search Radius" onPress={increaseRadius} /> : null}{mode === "search" ? <><AppButton title="View Nearby Shops" variant="secondary" onPress={() => { setMode("nearby"); run(location, radius, "nearby"); }} /><AppButton title="Try Another Search" variant="ghost" onPress={() => setTerm("")} /></> : null}</AppCard> : null}
    {shops.map((shop) => <AppCard key={shop.shopId}><View style={styles.top}><View style={styles.flex}><Text style={styles.name}>{shop.businessName}</Text><Text style={styles.meta}>{shop.distanceKm} km · ★ {shop.rating || 0} ({shop.totalReviews || 0})</Text></View><StatusBadge status="Online" tone="success" /></View><Text style={styles.body}>{shop.address || "Address unavailable"}</Text><Text style={styles.body}>{shop.availableItemCount || shop.matchingItems?.length || 0} available {mode === "search" ? "matches" : "items"}</Text>{(shop.matchingItems || []).slice(0, 3).map((item) => <View key={item.itemId} style={styles.match}><Text style={styles.matchName}>{item.name}</Text><Text style={styles.meta}>{[item.brand, item.partNumber, item.price != null ? `LKR ${item.price}` : null].filter(Boolean).join(" · ")}</Text></View>)}<View style={styles.actions}><AppButton title="View Parts" compact onPress={() => navigation.navigate("SparePartsShopDetails", { shopId: shop.shopId, location })} />{shop.location ? <AppButton title="Location" compact variant="secondary" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.location.latitude},${shop.location.longitude}`)} /> : null}{shop.phone ? <AppButton title="Call" compact variant="ghost" onPress={() => Linking.openURL(`tel:${shop.phone}`)} /> : null}</View></AppCard>)}
  </ScreenContainer>;
}
const styles = StyleSheet.create({ top: { flexDirection: "row", gap: spacing.sm }, flex: { flex: 1 }, name: { ...typography.sectionTitle, color: colors.primaryDark }, meta: { ...typography.caption, color: colors.textSecondary }, body: { ...typography.body, color: colors.textSecondary }, match: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs }, matchName: { ...typography.body, color: colors.textPrimary, fontWeight: "700" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs } });
