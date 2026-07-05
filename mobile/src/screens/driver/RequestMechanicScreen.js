import React, { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import { BREAKDOWN_TYPES, COLORS, MOCK_LOCATION, URGENCY_LEVELS, VEHICLE_TYPES } from "../../utils/constants";

export default function RequestMechanicScreen({ navigation, route }) {
  const prefill = route.params?.prefill || {};
  const [vehicleType, setVehicleType] = useState(prefill.vehicleType || "car");
  const [vehicleModel, setVehicleModel] = useState(prefill.vehicleModel || "");
  const [breakdownType, setBreakdownType] = useState(prefill.breakdownType || "flat_tyre");
  const [urgencyLevel, setUrgencyLevel] = useState("medium");
  const [problemDescription, setProblemDescription] = useState(prefill.problemDescription || "");
  const [currentLocation, setCurrentLocation] = useState(prefill.currentLocation || null);

  function handleUseLocation() {
    setCurrentLocation(MOCK_LOCATION);
    Alert.alert("Mock location added", MOCK_LOCATION.address);
  }

  function handleFindMechanic() {
    const requestForm = {
      vehicleType,
      vehicleModel,
      breakdownType,
      urgencyLevel,
      problemDescription,
      currentLocation: currentLocation || MOCK_LOCATION
    };

    navigation.navigate("Recommendation", { requestForm });
  }

  return (
    <ScreenContainer>
      <AppCard>
        <Text style={styles.title}>Request Mechanic</Text>
        <AppSelect label="Vehicle type" options={VEHICLE_TYPES} value={vehicleType} onChange={setVehicleType} />
        <AppInput
          label="Vehicle model/name (optional)"
          value={vehicleModel}
          onChangeText={setVehicleModel}
          placeholder="Example: Toyota Aqua"
        />
        <AppSelect label="Breakdown type" options={BREAKDOWN_TYPES} value={breakdownType} onChange={setBreakdownType} />
        <AppSelect label="Urgency level" options={URGENCY_LEVELS} value={urgencyLevel} onChange={setUrgencyLevel} />
        <AppInput
          label="Problem description"
          value={problemDescription}
          onChangeText={setProblemDescription}
          placeholder="Briefly describe the problem"
          multiline
        />
        <AppButton
          title={currentLocation ? `Location: ${currentLocation.address}` : "Use Current Location"}
          variant="secondary"
          onPress={handleUseLocation}
        />
        <AppButton title="Find Mechanic" onPress={handleFindMechanic} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 22,
    fontWeight: "900"
  }
});
