import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import AppButton from "../AppButton";
import AppInput from "../AppInput";
import InfoBanner from "../ui/InfoBanner";
import OpenStreetMapView from "./OpenStreetMapView";
import { colors, radii, shadows, spacing, typography } from "../../theme";
import {
  formatGeocodedAddress,
  normalizeLocation,
  regionForLocation,
  SRI_LANKA_REGION
} from "../../utils/locationPicker";

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("location_timeout")), milliseconds);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export default function LocationPicker({
  initialLocation,
  address,
  onLocationChange,
  onAddressChange
}) {
  const mapRef = useRef(null);
  const geocodeRequestRef = useRef(0);
  const [mapRegion, setMapRegion] = useState(() => regionForLocation(initialLocation));
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [nativeMapFailed, setNativeMapFailed] = useState(false);
  const [mapError, setMapError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
  const selectedLocation = normalizeLocation(initialLocation);
  const useOpenStreetMap = nativeMapFailed || (
    Platform.OS === "android" &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );

  useEffect(() => {
    if (!selectedLocation) return;
    const nextRegion = regionForLocation(selectedLocation);
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 350);
  }, [selectedLocation?.latitude, selectedLocation?.longitude]);

  useEffect(() => {
    if (!mapLoading) return undefined;
    const timer = setTimeout(() => {
      if (Platform.OS === "ios" && !useOpenStreetMap) {
        setNativeMapFailed(true);
        setMapError("");
        return;
      }
      setMapLoading(false);
      setMapError("The map is taking longer than expected to load. Check your connection and try again.");
    }, 12000);
    return () => clearTimeout(timer);
  }, [mapLoading, useOpenStreetMap, mapAttempt]);

  async function updateAddressFromCoordinates(coordinates) {
    const requestId = ++geocodeRequestRef.current;
    try {
      const places = await withTimeout(Location.reverseGeocodeAsync(coordinates), 10000);
      if (requestId !== geocodeRequestRef.current) return;
      const formattedAddress = formatGeocodedAddress(places[0]);
      if (formattedAddress) onAddressChange(formattedAddress);
      setLocationError("");
    } catch (_error) {
      if (requestId !== geocodeRequestRef.current) return;
      setLocationError("The location was selected, but we couldn't find its address. You can enter the address manually.");
    }
  }

  async function selectLocation(coordinates, centerMap = false) {
    const normalized = normalizeLocation(coordinates);
    if (!normalized) {
      setLocationError("That map location is invalid. Please choose another point.");
      return;
    }
    onLocationChange(normalized);
    if (centerMap) {
      const nextRegion = regionForLocation(normalized);
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 350);
    }
    await updateAddressFromCoordinates(normalized);
  }

  async function handleUseCurrentLocation() {
    setLocationError("");
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(permission.status);
      if (permission.status !== "granted") {
        setLocationError("Location permission was not granted. You can still select your service location manually on the map.");
        return;
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        15000
      );
      await selectLocation(position.coords, true);
    } catch (_error) {
      setLocationError("We couldn't get your current location. Check that location services are available, or select a point manually on the map.");
    } finally {
      setLocationLoading(false);
    }
  }

  function handleMapPress(event) {
    selectLocation(event.nativeEvent.coordinate);
  }

  function handleMarkerDragEnd(event) {
    selectLocation(event.nativeEvent.coordinate);
  }

  function handleAddressChange(nextAddress) {
    geocodeRequestRef.current += 1;
    onAddressChange(nextAddress);
  }

  function handleMapLoaded() {
    setMapLoading(false);
    setMapError("");
  }

  function handleRetryMap() {
    setMapError("");
    setMapLoading(true);
    setMapAttempt((attempt) => attempt + 1);
  }

  function handleMapError() {
    setMapLoading(false);
    setMapError("The map couldn't load. Check your internet connection and tap Retry Map.");
  }

  function handleUseFallback() {
    setMapError("");
    setMapLoading(true);
    setNativeMapFailed(true);
  }

  return (
    <View style={styles.container}>
      <AppInput
        label="Address"
        icon="location-outline"
        value={address}
        onChangeText={handleAddressChange}
        placeholder="No. 45, Galle Road, Colombo 03"
        multiline
      />

      <AppButton
        title={locationLoading ? "Getting your location..." : "Use My Current Location"}
        accessibilityLabel="Use my current location"
        icon="locate-outline"
        variant="secondary"
        disabled={locationLoading}
        onPress={handleUseCurrentLocation}
      />

      {locationError ? (
        <InfoBanner
          tone={locationPermissionStatus === "denied" ? "warning" : "info"}
          message={locationError}
        />
      ) : null}
      {mapError ? <InfoBanner tone="warning" message={mapError} /> : null}
      {!mapLoading ? (
        <AppButton
          title="Retry Map"
          icon="refresh-outline"
          variant="secondary"
          onPress={handleRetryMap}
        />
      ) : null}
      {Platform.OS === "ios" && !useOpenStreetMap && !mapLoading ? (
        <AppButton
          title="Map blank? Use OpenStreetMap"
          variant="ghost"
          onPress={handleUseFallback}
        />
      ) : null}

      <Text style={styles.instruction}>Tap the map or drag the pin to set your service location.</Text>
      <View style={styles.mapShell} collapsable={false}>
        {useOpenStreetMap ? (
          <OpenStreetMapView
            key={mapAttempt}
            location={selectedLocation}
            onSelect={selectLocation}
            onReady={handleMapLoaded}
            onError={handleMapError}
          />
        ) : (
        <MapView
          key={mapAttempt}
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          region={mapRegion || SRI_LANKA_REGION}
          onRegionChangeComplete={setMapRegion}
          onPress={handleMapPress}
          onMapReady={() => {
            if (Platform.OS !== "android") handleMapLoaded();
          }}
          onMapLoaded={handleMapLoaded}
          accessibilityLabel="Service location map"
        >
          {selectedLocation ? (
            <Marker
              coordinate={selectedLocation}
              draggable
              title="Service location"
              onDragEnd={handleMarkerDragEnd}
            />
          ) : null}
        </MapView>
        )}
        {mapLoading ? (
          <View style={styles.mapLoading} pointerEvents="none">
            <ActivityIndicator color={colors.teal} />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location on map"
          accessibilityState={{ disabled: locationLoading }}
          disabled={locationLoading}
          onPress={handleUseCurrentLocation}
          style={({ pressed }) => [styles.floatingLocation, pressed && styles.pressed]}
        >
          <Ionicons name="locate" size={22} color={colors.teal} />
        </Pressable>
      </View>

      <View style={styles.preview}>
        <View style={styles.previewIcon}>
          <Ionicons name="location" size={21} color={colors.teal} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle}>Selected Service Location</Text>
          <Text style={styles.previewAddress}>
            {selectedLocation
              ? address.trim() || "Pin selected — enter the service address above."
              : "No service location selected yet."}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  instruction: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  mapShell: {
    height: 240,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.softSurface
  },
  map: { width: "100%", height: "100%" },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.softSurface
  },
  mapLoadingText: { ...typography.caption, color: colors.textSecondary },
  floatingLocation: {
    position: "absolute",
    right: 12,
    bottom: 30,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    backgroundColor: colors.surface,
    ...shadows.floating
  },
  pressed: { opacity: 0.78 },
  preview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    ...shadows.card
  },
  previewIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.tealLight
  },
  previewCopy: { flex: 1, gap: spacing.xxs },
  previewTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  previewAddress: { ...typography.bodyStrong, color: colors.primaryDark, lineHeight: 21 }
});
