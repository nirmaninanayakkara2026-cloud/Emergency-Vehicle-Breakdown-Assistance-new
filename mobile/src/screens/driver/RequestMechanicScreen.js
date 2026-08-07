import React, { useState } from "react";
import * as Location from "expo-location";
import { StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import { createBreakdownRequest } from "../../services/requestService";
import { BREAKDOWN_TYPES, COLORS, MOCK_LOCATION, URGENCY_LEVELS, VEHICLE_TYPES } from "../../utils/constants";

export default function RequestMechanicScreen({ navigation, route }) {
  const prefill = route.params?.prefill || {};
  const [vehicleType, setVehicleType] = useState(prefill.vehicleType || "car");
  const [vehicleModel, setVehicleModel] = useState(prefill.vehicleModel || "");
  const [breakdownType, setBreakdownType] = useState(prefill.breakdownType || "flat_tyre");
  const [urgencyLevel, setUrgencyLevel] = useState("medium");
  const [problemDescription, setProblemDescription] = useState(prefill.problemDescription || "");
  const [address, setAddress] = useState(prefill.currentLocation?.address || "");
  const [latitude, setLatitude] = useState(prefill.currentLocation?.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(prefill.currentLocation?.longitude?.toString() || "");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleUseLocation() {
    setError("");
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location permission denied. Please enter your address manually.");
        setLatitude(MOCK_LOCATION.latitude.toString());
        setLongitude(MOCK_LOCATION.longitude.toString());
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords = position.coords;
      setLatitude(coords.latitude.toString());
      setLongitude(coords.longitude.toString());

      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude
        });
        const place = places[0];
        const resolvedAddress = place
          ? [place.name, place.street, place.city, place.region, place.country].filter(Boolean).join(", ")
          : "Current location";
        setAddress(resolvedAddress);
      } catch (reverseError) {
        setAddress("Current location");
      }
    } catch (locationError) {
      setError("Could not get current location. Please enter address manually.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function validateForm() {
    if (!problemDescription.trim()) return "Problem description is required.";
    if (!address.trim()) return "Address is required. Use current location or enter it manually.";
    if (!latitude || Number.isNaN(Number(latitude))) return "Latitude must be valid.";
    if (!longitude || Number.isNaN(Number(longitude))) return "Longitude must be valid.";
    return "";
  }

  async function handleSubmit() {
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const request = await createBreakdownRequest({
        vehicleType,
        vehicleModel: vehicleModel.trim() || undefined,
        breakdownType,
        urgencyLevel,
        problemDescription: problemDescription.trim(),
        location: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          address: address.trim()
        }
      });
      navigation.replace("RequestDetails", { requestId: request._id, request });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <AppCard>
        <Text style={styles.title}>Request Mechanic</Text>
        <AppSelect label="Vehicle type" options={VEHICLE_TYPES} value={vehicleType} onChange={setVehicleType} />
        <AppInput label="Vehicle model/name (optional)" value={vehicleModel} onChangeText={setVehicleModel} />
        <AppSelect label="Breakdown type" options={BREAKDOWN_TYPES} value={breakdownType} onChange={setBreakdownType} />
        <AppSelect label="Urgency level" options={URGENCY_LEVELS} value={urgencyLevel} onChange={setUrgencyLevel} />
        <AppInput label="Problem description" value={problemDescription} onChangeText={setProblemDescription} multiline />
        <AppButton title="Use Current Location" variant="secondary" onPress={handleUseLocation} loading={loadingLocation} />
        <AppInput label="Address" value={address} onChangeText={setAddress} multiline />
        <AppInput label="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
        <AppInput label="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title="Submit Request" onPress={handleSubmit} loading={submitting} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 22,
    fontWeight: "900"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
