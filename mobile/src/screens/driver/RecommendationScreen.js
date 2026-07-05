import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getRecommendedProviders } from "../../services/requestService";
import { COLORS, MOCK_LOCATION } from "../../utils/constants";

export default function RecommendationScreen({ navigation, route }) {
  const requestForm = route.params?.requestForm || {
    vehicleType: "car",
    breakdownType: "flat_tyre",
    urgencyLevel: "medium",
    currentLocation: MOCK_LOCATION
  };
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecommendedProviders().then(setProviders).finally(() => setLoading(false));
  }, []);

  function handleSelectProvider(provider) {
    const request = {
      id: `R-${Date.now().toString().slice(-5)}`,
      status: "Pending",
      provider,
      providerName: provider.name,
      providerPhone: provider.phone,
      ...requestForm
    };

    navigation.navigate("RequestTracking", { request });
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Recommended Providers</Text>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {providers.map((provider) => (
        <AppCard key={provider.id}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{provider.name}</Text>
            <Text style={[styles.badge, provider.available ? styles.available : styles.unavailable]}>
              {provider.available ? "Available" : "Busy"}
            </Text>
          </View>
          <Text style={styles.meta}>{provider.role.replaceAll("_", " ")}</Text>
          <Text style={styles.body}>Distance: {provider.distanceKm} km</Text>
          <Text style={styles.body}>Rating: {provider.rating}</Text>
          <Text style={styles.body}>Response time: {provider.responseTime}</Text>
          <Text style={styles.body}>Specialized in: {provider.specializations.join(", ")}</Text>
          <Text style={styles.body}>Estimated price: {provider.priceRange}</Text>
          <AppButton title="Select Provider" onPress={() => handleSelectProvider(provider)} />
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  cardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  meta: {
    color: COLORS.primaryDark,
    textTransform: "capitalize",
    fontWeight: "700"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: COLORS.surface,
    fontWeight: "800"
  },
  available: {
    backgroundColor: COLORS.success
  },
  unavailable: {
    backgroundColor: COLORS.danger
  }
});
