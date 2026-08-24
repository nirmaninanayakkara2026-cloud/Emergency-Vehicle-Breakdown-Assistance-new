export const SRI_LANKA_REGION = {
  latitude: 7.8731,
  longitude: 80.7718,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5
};

export function isValidLocation(location) {
  if (!location) return false;
  if (
    location.latitude === null ||
    location.latitude === undefined ||
    location.longitude === null ||
    location.longitude === undefined ||
    (typeof location.latitude === "string" && !location.latitude.trim()) ||
    (typeof location.longitude === "string" && !location.longitude.trim())
  ) return false;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function normalizeLocation(location) {
  if (!isValidLocation(location)) return null;
  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude)
  };
}

export function regionForLocation(location) {
  const normalized = normalizeLocation(location);
  if (!normalized) return SRI_LANKA_REGION;
  return {
    ...normalized,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012
  };
}

export function formatGeocodedAddress(place) {
  if (!place) return "";
  if (place.formattedAddress?.trim()) return place.formattedAddress.trim();
  return [place.name, place.street, place.district, place.city, place.region, place.postalCode, place.country]
    .filter(Boolean)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(", ");
}
