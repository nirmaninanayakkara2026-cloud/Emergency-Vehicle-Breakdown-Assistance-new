import * as Location from "expo-location";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import FormInput from "../components/FormInput";
import FormPicker from "../components/FormPicker";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { findNearbyShops } from "../services/shopService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F2F7F2", card: "#FFFFFF", primary: "#39724B", text: "#23422D",
  muted: "#68796D", border: "#D6E4D9", danger: "#C73E3E", success: "#39724B",
};
const vehicles = ["car", "bike", "van", "three_wheeler", "truck"].map((value) => ({ label: value.replaceAll("_", " "), value }));

export default function SparePartsFinderScreen() {
  const [partName, setPartName] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [shops, setShops] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is required");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setShops(await findNearbyShops({
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        partName: partName.trim() || undefined,
        vehicleType,
      }));
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  };

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Nearby spare parts" subtitle="Search shops using your current location." colors={SCREEN_COLORS} />
      <FormInput label="Part name (optional)" value={partName} onChangeText={setPartName} colors={SCREEN_COLORS} />
      <FormPicker label="Vehicle type" selectedValue={vehicleType} onValueChange={setVehicleType} options={vehicles} colors={SCREEN_COLORS} />
      <Message colors={SCREEN_COLORS}>{error}</Message>
      <AppButton title="Use location and search" loading={loading} onPress={search} colors={SCREEN_COLORS} />
      {shops.length === 0 && !loading ? <Text style={{ color: SCREEN_COLORS.muted, marginTop: 20 }}>Search to see nearby shops.</Text> : null}
      {shops.map((shop) => (
        <AppCard key={shop._id} colors={SCREEN_COLORS} style={styles.card}>
          <Text style={[styles.title, { color: SCREEN_COLORS.text }]}>{shop.shopName}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Distance: {shop.distanceKm} km</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Phone: {shop.phone}</Text>
          <Text style={{ color: SCREEN_COLORS.text }}>Hours: {typeof shop.openingHours === "string" ? shop.openingHours : JSON.stringify(shop.openingHours)}</Text>
          <Text style={{ color: SCREEN_COLORS.muted }}>Parts: {shop.availableParts.map((part) => `${part.partName} (${part.quantity})`).join(", ") || "No matching stock"}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: 14 }, title: { fontSize: 18, fontWeight: "800", marginBottom: 6 } });
