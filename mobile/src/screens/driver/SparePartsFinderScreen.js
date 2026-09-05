import React from "react";
import { StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { colors, typography } from "../../theme";

export default function SparePartsFinderScreen({ navigation }) {
  return <ScreenContainer>
    <ScreenHeader eyebrow="Driver tools" title="Spare Parts Finder" subtitle="Find real, in-stock parts from approved shops near your current location." />
    <AppCard><Text style={styles.title}>Search for a Part</Text><Text style={styles.body}>Search by part name, category, brand, part number, or compatible vehicle.</Text><AppButton title="Search Spare Parts" icon="search-outline" onPress={() => navigation.navigate("NearbySpareParts", { mode: "search" })} /></AppCard>
    <AppCard><Text style={styles.title}>View Nearby Shops</Text><Text style={styles.body}>Browse approved spare-parts shops that are currently online.</Text><AppButton title="View Nearby Shops" icon="location-outline" variant="secondary" onPress={() => navigation.navigate("NearbySpareParts", { mode: "nearby" })} /></AppCard>
  </ScreenContainer>;
}
const styles = StyleSheet.create({ title: { ...typography.sectionTitle, color: colors.primaryDark }, body: { ...typography.body, color: colors.textSecondary } });
