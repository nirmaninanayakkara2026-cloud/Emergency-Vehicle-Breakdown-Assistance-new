import { normalizeLocation } from "./locationPicker";

export function canShowProviderRoute(status) {
  return ["accepted", "provider_en_route", "on_the_way", "arrived", "in_progress"].includes(status);
}

export function shouldRefreshRequest(status) {
  return !["completed", "cancelled", "provider_rejected"].includes(status);
}

export function buildDirectionsUrl(origin, destination) {
  const start = normalizeLocation(origin);
  const end = normalizeLocation(destination);
  if (!start || !end) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${start.latitude},${start.longitude}`)}&destination=${encodeURIComponent(`${end.latitude},${end.longitude}`)}&travelmode=driving`;
}

export function buildRoadRouteUrl(origin, destination) {
  const start = normalizeLocation(origin);
  const end = normalizeLocation(destination);
  if (!start || !end) return null;
  const base = (process.env.EXPO_PUBLIC_ROUTING_BASE_URL || "https://router.project-osrm.org").replace(/\/$/, "");
  return `${base}/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=false`;
}

export function parseRoadRoute(data) {
  const route = data?.routes?.[0];
  if (data?.code !== "Ok" || route?.geometry?.type !== "LineString" ||
      !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 ||
      !Number.isFinite(route.distance) || route.distance < 0 ||
      !Number.isFinite(route.duration) || route.duration < 0) return null;
  const coordinates = route.geometry.coordinates.map((point) =>
    Array.isArray(point) ? normalizeLocation({ latitude: point[1], longitude: point[0] }) : null
  );
  if (coordinates.some((point) => !point)) return null;
  return { coordinates, distanceKm: route.distance / 1000, durationMinutes: Math.ceil(route.duration / 60) };
}
