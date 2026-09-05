import React, { useCallback, useEffect, useState } from "react";
import { Linking, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import ErrorState from "../../components/ui/ErrorState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { cancelRequest, getRequestById } from "../../services/requestService";
import { colors, radii, spacing, typography } from "../../theme";
import { formatFaultLabel, formatRequestStatus, formatServiceType } from "../../utils/displayLabels";

const TIMELINE = [
  ["provider_requested", "Request Sent", "paper-plane"], ["accepted", "Provider Accepted", "checkmark"],
  ["provider_en_route", "On the Way", "car"], ["arrived", "Arrived", "location"],
  ["in_progress", "Repair in Progress", "construct"], ["completed", "Completed", "checkmark-done"]
];
const STATUS_INDEX = { provider_requested: 0, recommended: 0, accepted: 1, provider_en_route: 2, on_the_way: 2, arrived: 3, in_progress: 4, completed: 5 };

export default function RequestTrackingScreen({ navigation, route }) {
  const [request, setRequest] = useState(route.params?.request || null); const [loading, setLoading] = useState(!route.params?.request);
  const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [cancellationReason, setCancellationReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestId = route.params?.requestId || request?._id;
  const loadRequest = useCallback(async () => { setError(""); if (!requestId) { setError("This request could not be opened."); setLoading(false); setRefreshing(false); return; } try { const data = await getRequestById(requestId); if (data.status === "completed") { navigation.replace("JobCompletion", { requestId, request: data }); return; } setRequest(data); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); setRefreshing(false); } }, [navigation, requestId]);
  useEffect(() => { loadRequest(); }, [loadRequest]);
  async function handleCancel() { setSubmitting(true); setError(""); try { setRequest(await cancelRequest(requestId, cancellationReason)); } catch (cancelError) { setError(cancelError.message); } finally { setSubmitting(false); } }
  if (loading || !request || request.status === "completed") return <ScreenContainer scroll={false}><LoadingState message={request?.status === "completed" ? "Opening completed service..." : "Loading request details..."} /></ScreenContainer>;

  const activeIndex = STATUS_INDEX[request.status] ?? -1; const provider = request.selectedProviderId;
  return <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequest(); }} />}>
    <ScreenHeader eyebrow="Live roadside request" title="Help is on the way" subtitle="Follow your provider's progress here." right={<StatusBadge status={request.status} tone={request.status === "completed" ? "success" : "info"} />} />
    {error ? <AppCard><ErrorState message="We couldn't update this request. Please try again." onRetry={loadRequest} /></AppCard> : null}
    {request.status === "provider_rejected" ? <InfoBanner tone="warning" title="Provider unavailable" message="Choose another suitable provider to continue." /> : null}
    {request.status === "provider_rejected" ? <AppButton title="Choose Another Provider" onPress={() => navigation.replace("Recommendation", { requestId, request, aiPrediction: request.aiPrediction })} /> : null}
    <AppCard style={styles.providerCard}><View style={styles.providerTop}><View style={styles.providerIcon}><Ionicons name="construct" size={26} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.providerName}>{provider?.businessName || "Awaiting provider selection"}</Text>{provider ? <Text style={styles.service}>{formatServiceType(provider.providerType)}</Text> : null}</View></View>{provider ? <View style={styles.providerMeta}><Text style={styles.eta}>{request.estimatedArrivalMinutes ? `${request.estimatedArrivalMinutes} min` : "ETA pending"}</Text><Text style={styles.etaLabel}>Estimated arrival</Text></View> : null}{provider?.phone ? <AppButton title="Call Provider" icon="call-outline" variant="secondary" onPress={() => Linking.openURL(`tel:${provider.phone}`)} /> : null}</AppCard>
    <AppCard><Text style={styles.cardTitle}>Request Progress</Text><View style={styles.timeline}>{TIMELINE.map(([key, label, icon], index) => { const complete = index <= activeIndex; const current = index === activeIndex; return <View key={key} style={styles.timelineRow}>{index < TIMELINE.length - 1 ? <View style={[styles.line, complete && styles.activeLine]} /> : null}<View style={[styles.dot, complete && styles.activeDot, current && styles.currentDot]}><Ionicons name={complete ? "checkmark" : icon} size={17} color={complete ? colors.surface : colors.muted} /></View><View style={styles.timelineCopy}><Text style={[styles.timelineText, complete && styles.activeText]}>{label}</Text>{current ? <Text style={styles.current}>Current status</Text> : null}</View></View>; })}</View></AppCard>
    <AppCard><Text style={styles.cardTitle}>Request Summary</Text><Detail icon="information-circle-outline" label="Possible problem" value={formatFaultLabel(request.aiPrediction?.predictedFault, request.aiPrediction?.faultLabel || "Inspection required")} /><Detail icon="construct-outline" label="Required service" value={formatServiceType(request.requiredServiceType)} />{request.estimatedCostRange ? <Detail icon="wallet-outline" label="Estimated service range" value={`${request.estimatedCostRange.currency} ${Number(request.estimatedCostRange.min).toLocaleString()} – ${Number(request.estimatedCostRange.max).toLocaleString()}`} note="Actual cost may vary after inspection." /> : null}{request.finalCost != null ? <Detail icon="receipt-outline" label="Final cost" value={`LKR ${Number(request.finalCost).toLocaleString()}`} /> : null}</AppCard>
    {!['completed','cancelled'].includes(request.status) ? <AppCard style={styles.cancelCard}><Text style={styles.cardTitle}>Need to cancel?</Text><AppInput label="Cancellation reason (optional)" value={cancellationReason} onChangeText={setCancellationReason} multiline /><AppButton title="Cancel Request" variant="danger" loading={submitting} onPress={handleCancel} /></AppCard> : null}
    <View style={styles.bottomActions}><AppButton title="Refresh Status" icon="refresh-outline" variant="secondary" onPress={loadRequest} /><AppButton title="Back to My Requests" variant="ghost" onPress={() => navigation.navigate("MyRequests")} /></View>
  </ScreenContainer>;
}

function Detail({ icon, label, value, note }) { return <View style={styles.detail}><Ionicons name={icon} size={21} color={colors.teal} /><View style={styles.flex}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text>{note ? <Text style={styles.note}>{note}</Text> : null}</View></View>; }
const styles = StyleSheet.create({
  flex: { flex: 1 }, providerCard: { backgroundColor: colors.surface }, providerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, providerIcon: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" }, providerName: { ...typography.sectionTitle, color: colors.primaryDark }, service: { ...typography.body, color: colors.textSecondary }, providerMeta: { backgroundColor: colors.tealLight, borderRadius: radii.md, padding: spacing.md }, eta: { ...typography.pageTitle, color: colors.teal }, etaLabel: { ...typography.caption, color: colors.textSecondary }, cardTitle: { ...typography.sectionTitle, color: colors.textPrimary }, timeline: { paddingTop: spacing.xs }, timelineRow: { minHeight: 66, flexDirection: "row", gap: spacing.sm }, line: { position: "absolute", left: 17, top: 34, bottom: -1, width: 2, backgroundColor: colors.border }, activeLine: { backgroundColor: colors.teal }, dot: { width: 36, height: 36, zIndex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.softSurface, borderWidth: 1, borderColor: colors.border }, activeDot: { backgroundColor: colors.teal, borderColor: colors.teal }, currentDot: { borderWidth: 4, borderColor: colors.tealLight }, timelineCopy: { flex: 1, paddingTop: 7 }, timelineText: { ...typography.bodyStrong, color: colors.textSecondary }, activeText: { color: colors.textPrimary }, current: { ...typography.caption, color: colors.teal }, detail: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs }, detailLabel: { ...typography.caption, color: colors.textSecondary }, detailValue: { ...typography.bodyStrong, color: colors.textPrimary }, note: { ...typography.caption, color: colors.textSecondary, fontStyle: "italic" }, ratingRow: { flexDirection: "row", justifyContent: "center" }, star: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }, cancelCard: { borderColor: "#F5CACA" }, bottomActions: { gap: spacing.sm }
});
