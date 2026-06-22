import * as Location from "expo-location";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import FormInput from "../components/FormInput";
import FormPicker from "../components/FormPicker";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { createBreakdownRequest } from "../services/breakdownService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#FFF8F1", card: "#FFFFFF", primary: "#C45D20", text: "#4A2C1B",
  muted: "#7C6A5F", border: "#E8D8CC", danger: "#C73E3E", success: "#23845D",
};
const option = (value) => ({ label: value.replaceAll("_", " "), value });
const vehicleTypes = ["car", "bike", "van", "three_wheeler", "truck"].map(option);
const breakdownTypes = ["flat_tire", "battery_issue", "engine_overheating", "brake_issue", "electrical_issue", "accident", "vehicle_not_starting", "towing_needed", "other"].map(option);
const urgencyLevels = ["low", "medium", "high"].map(option);

export default function CreateBreakdownRequestScreen({ navigation }) {
  const [form, setForm] = useState({ vehicleType: "car", vehicleModel: "", breakdownType: "flat_tire", urgencyLevel: "medium", problemDescription: "" });
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const getLocation = async () => {
    setLocationLoading(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is required");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = current.coords;
      setLocation({ latitude, longitude, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
    } catch (locationError) { setError(getErrorMessage(locationError)); }
    finally { setLocationLoading(false); }
  };

  const submit = async () => {
    if (!location) { setError("Please get your current location first"); return; }
    setLoading(true);
    setError("");
    try {
      const result = await createBreakdownRequest({ ...form, location });
      Alert.alert("AI prediction", `Recommended service: ${result.prediction.serviceType}`);
      navigation.replace("Recommendation", { requestId: result.breakdownRequest._id });
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  };

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Describe the problem" subtitle="The AI model will suggest the most suitable service type." colors={SCREEN_COLORS} />
      <FormPicker label="Vehicle type" options={vehicleTypes} selectedValue={form.vehicleType} onValueChange={update("vehicleType")} colors={SCREEN_COLORS} />
      <FormInput label="Vehicle model" value={form.vehicleModel} onChangeText={update("vehicleModel")} colors={SCREEN_COLORS} />
      <FormPicker label="Breakdown type" options={breakdownTypes} selectedValue={form.breakdownType} onValueChange={update("breakdownType")} colors={SCREEN_COLORS} />
      <FormPicker label="Urgency" options={urgencyLevels} selectedValue={form.urgencyLevel} onValueChange={update("urgencyLevel")} colors={SCREEN_COLORS} />
      <FormInput label="Problem description" value={form.problemDescription} onChangeText={update("problemDescription")} multiline colors={SCREEN_COLORS} />
      <AppButton title={location ? "Refresh current location" : "Get current location"} variant="secondary" loading={locationLoading} onPress={getLocation} colors={SCREEN_COLORS} />
      {location ? <View style={styles.location}><Text style={{ color: SCREEN_COLORS.success }}>Location ready: {location.address}</Text></View> : null}
      <Message colors={SCREEN_COLORS}>{error}</Message>
      <AppButton title="Submit request" loading={loading} onPress={submit} colors={SCREEN_COLORS} />
    </Screen>
  );
}

const styles = StyleSheet.create({ location: { marginVertical: 12 } });
