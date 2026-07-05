import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import { findSpareParts } from "../../services/requestService";
import { COLORS, VEHICLE_TYPES } from "../../utils/constants";

export default function SparePartsFinderScreen() {
  const [partName, setPartName] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const shops = await findSpareParts(partName, vehicleType);
    setResults(shops);
    setSearched(true);
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Spare Parts Finder</Text>
      <AppCard>
        <AppInput label="Part name" value={partName} onChangeText={setPartName} placeholder="Example: Battery" />
        <AppSelect label="Vehicle type" options={VEHICLE_TYPES} value={vehicleType} onChange={setVehicleType} />
        <AppButton title="Search Parts" onPress={handleSearch} />
      </AppCard>

      {searched && results.length === 0 ? <Text style={styles.empty}>No mock shop results found.</Text> : null}
      {results.map((shop) => (
        <AppCard key={shop.id}>
          <Text style={styles.cardTitle}>{shop.name}</Text>
          <Text style={styles.body}>Distance: {shop.distanceKm} km</Text>
          <Text style={styles.body}>Phone: {shop.phone}</Text>
          <Text style={styles.body}>Available parts: {shop.availableParts.join(", ")}</Text>
          <Text style={styles.body}>Opening hours: {shop.openingHours}</Text>
        </AppCard>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  empty: {
    color: COLORS.muted
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21
  }
});
