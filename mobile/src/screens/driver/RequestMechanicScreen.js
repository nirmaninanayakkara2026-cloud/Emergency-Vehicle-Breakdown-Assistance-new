import React, { useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import { StyleSheet, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import SymptomSummaryCard from "../../components/symptom/SymptomSummaryCard";
import MainProblemGrid from "../../components/symptom/MainProblemGrid";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import { createBreakdownRequest } from "../../services/requestService";
import {
  buildSymptomDescription,
  buildSymptomSummary,
  mapRequestTypeToSymptomType,
  mapSymptomTypeToRequestType,
} from "../../services/symptomCaptureService";
import {
  getBreakdownTypesForVehicle,
  getCompatibleBreakdownType,
  MOCK_LOCATION,
  URGENCY_LEVELS,
  VEHICLE_TYPES,
} from "../../utils/constants";
import { spacing } from "../../theme";

export default function RequestMechanicScreen({ navigation, route }) {
  // Initialize the request form from any previous or AI-generated draft.
  const prefill = route.params?.prefill || {};
  const initialVehicleType = prefill.vehicleType || "car";
  const [vehicleType, setVehicleType] = useState(initialVehicleType);
  const [vehicleModel, setVehicleModel] = useState(prefill.vehicleModel || "");
  const [breakdownType, setBreakdownType] = useState(
    getCompatibleBreakdownType(
      initialVehicleType,
      mapRequestTypeToSymptomType(prefill.breakdownType || "flat_tyre"),
    ),
  );
  const [urgencyLevel, setUrgencyLevel] = useState(
    prefill.urgencyLevel || "medium",
  );
  const [problemDescription, setProblemDescription] = useState(
    prefill.problemDescription || "",
  );
  const [guidedSymptoms, setGuidedSymptoms] = useState(
    prefill.guidedSymptoms || null,
  );
  const initialLocation = prefill.location || prefill.currentLocation || {};
  const [address, setAddress] = useState(initialLocation.address || "");
  const [latitude, setLatitude] = useState(
    initialLocation.latitude?.toString() || "",
  );
  const [longitude, setLongitude] = useState(
    initialLocation.longitude?.toString() || "",
  );
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const guidedSummary = useMemo(
    () => (guidedSymptoms ? buildSymptomSummary(guidedSymptoms) : null),
    [guidedSymptoms],
  );

  // Restore guided symptom data returned from the capture screen.
  useEffect(() => {
    const capturedSymptoms = route.params?.guidedSymptoms;
    if (!capturedSymptoms) return;
    setGuidedSymptoms(capturedSymptoms);
    setVehicleType(capturedSymptoms.vehicleType);
    setBreakdownType(getCompatibleBreakdownType(
      capturedSymptoms.vehicleType,
      capturedSymptoms.breakdownType,
    ));
  }, [route.params?.guidedSymptoms]);

  // Clear guided symptoms when the selected vehicle or problem changes.
  function changeVehicleType(nextVehicleType) {
    if (guidedSymptoms && guidedSymptoms.vehicleType !== nextVehicleType)
      setGuidedSymptoms(null);
    setBreakdownType((current) =>
      getCompatibleBreakdownType(nextVehicleType, current));
    setVehicleType(nextVehicleType);
  }
  // Clear guided symptoms when the selected vehicle or problem changes.
  function changeBreakdownType(nextBreakdownType) {
    if (guidedSymptoms && guidedSymptoms.breakdownType !== nextBreakdownType) {
      setGuidedSymptoms(null);
    }
    setBreakdownType(nextBreakdownType);
  }

  // Open guided symptom capture with compatible existing answers.
  function openGuidedSymptoms() {
    const currentGuidedSymptoms =
      guidedSymptoms?.vehicleType === vehicleType &&
      guidedSymptoms?.breakdownType === breakdownType
        ? guidedSymptoms
        : undefined;
    navigation.navigate("GuidedSymptomCapture", {
      sourceRoute: "RequestMechanic",
      vehicleType,
      breakdownType,
      initialData: currentGuidedSymptoms,
    });
  }

  // Request coordinates and resolve the current address when possible.
  async function handleUseLocation() {
    setError("");
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError(
          "Location permission denied. Please enter your address manually.",
        );
        setLatitude(MOCK_LOCATION.latitude.toString());
        setLongitude(MOCK_LOCATION.longitude.toString());
        return;
      }
      // Get the current position and update the latitude and longitude state.
      const position = await Location.getCurrentPositionAsync({});
      const coords = position.coords;
      setLatitude(coords.latitude.toString());
      setLongitude(coords.longitude.toString());
      // Attempt to reverse geocode the coordinates to get a human-readable address.
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        const place = places[0];
        const resolvedAddress = place
          ? [place.name, place.street, place.city, place.region, place.country]
              .filter(Boolean)
              .join(", ")
          : "Current location";
        setAddress(resolvedAddress);
      } catch (reverseError) {
        setAddress("Current location");
      }
    } catch (locationError) {
      setError(
        "Could not get current location. Please enter address manually.",
      );
    } finally {
      setLoadingLocation(false);
    }
  }

  // Validate coordinates before creating the breakdown request.
  function validateForm() {
    if (!latitude || Number.isNaN(Number(latitude)))
      return "Latitude must be valid.";
    if (!longitude || Number.isNaN(Number(longitude)))
      return "Longitude must be valid.";
    return "";
  }

  // Build and submit the request, then route to clarification or recommendations.
  async function handleSubmit() {
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    // Build the request draft with all relevant information, including guided symptoms and any prefilled data.
    try {
      const requestDraft = {
        vehicleType,
        vehicleModel: vehicleModel.trim() || undefined,
        breakdownType: mapSymptomTypeToRequestType(breakdownType),
        urgencyLevel,
        problemDescription: problemDescription.trim() || undefined,
        location: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          address: address.trim() || undefined,
        },
        troubleshootingSessionId: prefill.troubleshootingSessionId,
        diagnosticInputText:
          prefill.diagnosticInputText ||
          (guidedSymptoms
            ? buildSymptomDescription(guidedSymptoms)
            : undefined),
        predictedFault: prefill.predictedFault,
        requiredService: prefill.requiredService || prefill.requiredServiceType,
        guidedSymptoms,
        symptomCapture:
          prefill.symptomCapture ||
          (guidedSymptoms
            ? {
                symptoms: guidedSymptoms.symptoms || {},
                observedSymptoms: guidedSymptoms.observedSymptoms || {},
                additionalDescription: guidedSymptoms.description || "",
                guidedCaptureUsed: true,
              }
            : undefined),
      };
      const request = await createBreakdownRequest(requestDraft);
      // Route to the AI clarification screen if more information is needed, otherwise go to the recommendation screen.
      if (request.aiPrediction?.needsMoreInformation) {
        navigation.replace("AIClarification", {
          requestId: request._id,
          request,
          aiPrediction: request.aiPrediction,
          requestDraft,
        });
      } else {
        navigation.replace("Recommendation", {
          requestId: request._id,
          request,
          aiPrediction: request.aiPrediction,
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer keyboard>
      {/* Request form header and assistance introduction. */}
      <ScreenHeader
        eyebrow="Roadside assistance"
        title="Request a mechanic"
        subtitle="Tell us what happened and we'll find suitable nearby help."
      />
      {/* Vehicle information section. */}
      <AppCard>
        <SectionHeader title="1. Vehicle" subtitle="What are you driving?" />
        <AppSelect
          label="Vehicle type"
          options={VEHICLE_TYPES}
          value={vehicleType}
          onChange={changeVehicleType}
        />
        <AppInput
          label="Vehicle model or name (optional)"
          icon="car-outline"
          value={vehicleModel}
          onChangeText={setVehicleModel}
        />
      </AppCard>
      {/* Main breakdown category section. */}
      <AppCard>
        <SectionHeader
          title="2. Main Problem"
          subtitle="Choose the closest match."
        />
        <MainProblemGrid
          options={getBreakdownTypesForVehicle(vehicleType)}
          value={breakdownType}
          onChange={changeBreakdownType}
        />
      </AppCard>
      {/* Guided symptoms and optional problem description section. */}
      <AppCard>
        <SectionHeader
          title="3. Symptoms"
          subtitle="Guided details improve the service match."
        />
        <AppButton
          title={
            guidedSymptoms ? "Edit Symptoms" : "Help Me Describe the Problem"
          }
          variant="secondary"
          icon="chatbubbles-outline"
          onPress={openGuidedSymptoms}
        />
        {guidedSymptoms ? (
          <InfoBanner
            tone="success"
            message="Symptoms added to this request."
          />
        ) : null}
        <AppInput
          label="Problem description (optional)"
          value={problemDescription}
          onChangeText={setProblemDescription}
          multiline
        />
      </AppCard>
      {guidedSummary ? (
        <SymptomSummaryCard summary={guidedSummary} compact />
      ) : null}
      {/* Location and coordinates used for nearby provider matching. */}
      <AppCard>
        <SectionHeader
          title="4. Location"
          subtitle="Your position is used to find nearby providers."
        />
        <AppButton
          title="Use Current Location"
          icon="locate-outline"
          variant="secondary"
          onPress={handleUseLocation}
          loading={loadingLocation}
        />
        <AppInput
          label="Address (optional)"
          icon="location-outline"
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <View style={styles.coordinateRow}>
          <View style={styles.coordinate}>
            <AppInput
              label="Latitude"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.coordinate}>
            <AppInput
              label="Longitude"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numeric"
            />
          </View>
        </View>
      </AppCard>
      {/* Assistance urgency selection and final validation feedback. */}
      <AppCard>
        <SectionHeader
          title="5. Urgency"
          subtitle="How quickly do you need assistance?"
        />
        <AppSelect
          label="Urgency level"
          options={URGENCY_LEVELS}
          value={urgencyLevel}
          onChange={setUrgencyLevel}
        />
      </AppCard>
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {/* Submit the request and find suitable mechanics. */}
      <AppButton
        title="Find Suitable Mechanics"
        icon="search-outline"
        onPress={handleSubmit}
        loading={submitting}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  coordinateRow: { flexDirection: "row", gap: spacing.sm },
  coordinate: { flex: 1 },
});
