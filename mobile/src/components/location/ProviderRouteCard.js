import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import MapDocument from "./MapDocument";
import AppButton from "../AppButton";
import AppCard from "../AppCard";
import InfoBanner from "../ui/InfoBanner";
import { getRoadRoute } from "../../services/routeService";
import { normalizeLocation } from "../../utils/locationPicker";
import { buildDirectionsUrl, canShowProviderRoute } from "../../utils/providerTracking";
import { buildProviderRouteMapHtml } from "../../utils/providerRouteMap";
import { colors, radii, spacing, typography } from "../../theme";

export default function ProviderRouteCard({ request }) {
  if (!canShowProviderRoute(request?.status)) return null;
  const provider = request.selectedProviderId;
  const origin = normalizeLocation(provider?.location);
  const destination = normalizeLocation(request.location);
  // Remount only when an endpoint changes, keeping the map stable during status polling.
  return <RouteCard key={`${provider?._id}:${origin?.latitude},${origin?.longitude}:${destination?.latitude},${destination?.longitude}`}
    provider={provider} origin={origin} destination={destination} />;
}

function RouteCard({ provider, origin, destination }) {
  const webRef = useRef(null);
  const initialized = useRef(false);
  const [roadRoute, setRoadRoute] = useState(null);
  const latestRoute = useRef(null);
  latestRoute.current = roadRoute;
  const [routeLoading, setRouteLoading] = useState(Boolean(origin && destination));
  const [routeError, setRouteError] = useState("");
  const [mapLoading, setMapLoading] = useState(Boolean(origin || destination));
  const [mapError, setMapError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const source = useMemo(() => ({ html: buildProviderRouteMapHtml(origin, destination) }), [attempt]);
  const directionsUrl = buildDirectionsUrl(origin, destination);

  function updateRoute(route) {
    webRef.current?.setRoadRoute(route?.coordinates || []);
  }

  useEffect(() => {
    if (!origin || !destination) return undefined;
    const controller = new AbortController();
    setRouteLoading(true);
    setRouteError("");
    getRoadRoute(origin, destination, controller.signal).then((result) => {
      if (!controller.signal.aborted) setRoadRoute(result);
    }).catch(() => {
      if (!controller.signal.aborted) setRouteError("The road route couldn't load. Retry or open the route in Google Maps.");
    }).finally(() => {
      if (!controller.signal.aborted) setRouteLoading(false);
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (initialized.current) updateRoute(roadRoute);
  }, [roadRoute]);

  useEffect(() => {
    if (!mapLoading) return undefined;
    const timer = setTimeout(() => failMap(), 12000);
    return () => clearTimeout(timer);
  }, [mapLoading, attempt]);

  function failMap() {
    setMapLoading(false);
    setMapError("The map couldn't load. Check your connection and retry.");
  }

  function handleMessage(event) {
    try {
      const { type } = JSON.parse(event.nativeEvent.data);
      if (type === "initialized") {
        initialized.current = true;
        updateRoute(latestRoute.current);
      } else if (type === "ready") {
        setMapLoading(false);
        setMapError("");
      } else if (type === "error") failMap();
    } catch (_) { /* Ignore malformed map messages. */ }
  }

  return (
    <AppCard>
      <Text style={styles.title}>Provider Location & Route</Text>
      <Text style={styles.body}>Route from {provider?.businessName || "your provider"} to your breakdown location.</Text>
      <Text style={styles.note}>Uses the provider's saved service location.</Text>
      {origin || destination ? (
        <View style={styles.mapFrame}>
          <MapDocument key={attempt} ref={webRef} source={source} style={styles.map}
            originWhitelist={["*"]} applicationNameForUserAgent="RoadCare/1.0"
            javaScriptEnabled domStorageEnabled cacheEnabled scrollEnabled={false} bounces={false}
            onMessage={handleMessage} onError={failMap} onHttpError={failMap}
            onContentProcessDidTerminate={failMap} onRenderProcessGone={failMap}
            onShouldStartLoadWithRequest={({ url }) => {
              if (url === "about:blank" || url.startsWith("about:blank#")) return true;
              if (url === "https://www.openstreetmap.org/copyright") Linking.openURL(url).catch(() => {});
              return false;
            }} accessibilityLabel="Map showing provider service location and your breakdown location" />
          {mapLoading ? <View style={styles.overlay} pointerEvents="none"><ActivityIndicator color={colors.primary} /><Text style={styles.body}>Loading map...</Text></View> : null}
        </View>
      ) : null}
      <View style={styles.legend}>
        <Text style={styles.providerLabel}>● Provider service location</Text>
        <Text style={styles.driverLabel}>● Your breakdown location</Text>
      </View>
      {provider?.location?.address ? <Text style={styles.body}>{provider.location.address}</Text> : null}
      {!origin || !destination ? <InfoBanner tone="warning" title="Location unavailable"
        message={!origin ? "The provider's location is unavailable. Contact the provider for their location." : "Your breakdown location is unavailable, so a route cannot be shown."} /> : null}
      {routeLoading ? <Text style={styles.body}>Finding driving route...</Text> : null}
      {roadRoute ? <Text style={styles.body}>{roadRoute.distanceKm.toFixed(1)} km · About {roadRoute.durationMinutes} min driving</Text> : null}
      {roadRoute ? <Text style={styles.note}>Travel time estimate excludes live traffic and provider preparation time.</Text> : null}
      {mapError || routeError ? <>
        <InfoBanner tone="warning" title="Map or route unavailable" message={[mapError, routeError].filter(Boolean).join(" ")} />
        <AppButton title="Retry Map & Route" variant="secondary" onPress={() => {
          initialized.current = false;
          setMapError("");
          setMapLoading(Boolean(origin || destination));
          setAttempt((value) => value + 1);
        }} />
      </> : null}
      {directionsUrl ? <AppButton title="Open Route in Google Maps" icon="navigate-outline" variant="secondary" onPress={async () => {
        setLinkError("");
        try { await Linking.openURL(directionsUrl); }
        catch (_) { setLinkError("Google Maps couldn't open. Please try again."); }
      }} /> : null}
      {linkError ? <Text style={styles.error}>{linkError}</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  note: { ...typography.caption, color: colors.textSecondary },
  mapFrame: { height: 300, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.softSurface },
  map: { flex: 1, backgroundColor: "transparent" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: colors.softSurface, gap: spacing.sm },
  legend: { gap: spacing.xs },
  providerLabel: { ...typography.caption, color: "#0f766e" },
  driverLabel: { ...typography.caption, color: "#2563eb" },
  error: { ...typography.caption, color: colors.danger },
});
