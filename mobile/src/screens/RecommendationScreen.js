import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { getRecommendations, selectProvider } from "../services/breakdownService";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F4F4FC", card: "#FFFFFF", primary: "#5552A5", text: "#29284D",
  muted: "#706F87", border: "#DFDEF0", danger: "#C73E3E", success: "#23845D",
};

export default function RecommendationScreen({ route, navigation }) {
  const { requestId } = route.params;
  const [data, setData] = useState({ recommendations: [] });
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState("");

  useEffect(() => {
    getRecommendations(requestId).then(setData).catch((requestError) => setError(getErrorMessage(requestError)));
  }, [requestId]);

  const choose = async (item) => {
    setSelecting(String(item.providerId));
    setError("");
    try {
      const providerUserId = item.userId?._id || item.userId;
      await selectProvider(requestId, providerUserId, item.providerType);
      navigation.replace("RequestTracking", { requestId });
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setSelecting(""); }
  };

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Recommended providers" subtitle={`Predicted service: ${data.predictedServiceType || "Loading..."}`} colors={SCREEN_COLORS} />
      <Message colors={SCREEN_COLORS}>{error}</Message>
      {data.recommendations.length === 0 && !error ? <Text style={{ color: SCREEN_COLORS.muted }}>No matching available providers found.</Text> : null}
      {data.recommendations.map((item) => {
        const profile = item.profile;
        const name = profile.fullName || profile.garageName || item.userId?.name || "Service provider";
        const skills = profile.specializations || profile.services || [];
        return (
          <AppCard key={`${item.providerType}-${item.providerId}`} colors={SCREEN_COLORS}>
            <Text style={[styles.name, { color: SCREEN_COLORS.text }]}>{name}</Text>
            <Text style={{ color: SCREEN_COLORS.muted }}>{skills.join(", ") || item.providerType}</Text>
            <Text style={{ color: SCREEN_COLORS.text }}>Distance: {item.distanceKm} km</Text>
            <Text style={{ color: SCREEN_COLORS.text }}>Rating: {profile.averageRating || 0}/5</Text>
            <Text style={{ color: SCREEN_COLORS.text }}>Response: {profile.averageResponseTimeMinutes || "N/A"} min</Text>
            <Text style={{ color: SCREEN_COLORS.text }}>Score: {item.score}</Text>
            <Text style={{ color: SCREEN_COLORS.success }}>Availability: {profile.availabilityStatus}</Text>
            <AppButton title="Select provider" loading={selecting === String(item.providerId)} onPress={() => choose(item)} colors={SCREEN_COLORS} />
          </AppCard>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({ name: { fontSize: 18, fontWeight: "800", marginBottom: 5 } });
