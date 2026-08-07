import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { getMyProviderProfile } from "../../services/providerService";
import { COLORS } from "../../utils/constants";

export default function ProviderEntryScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const checkProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await getMyProviderProfile();
      navigation.replace("ProviderDashboard");
    } catch (profileError) {
      if (profileError.message.toLowerCase().includes("not found")) {
        navigation.replace("ProviderProfile");
        return;
      }
      setError(profileError.message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    checkProfile();
  }, [checkProfile]);

  return (
    <ScreenContainer>
      <AppCard>
        <Text style={styles.title}>Checking provider profile</Text>
        {loading ? <ActivityIndicator color={COLORS.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading ? <AppButton title="Retry" onPress={checkProfile} /> : null}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 20,
    fontWeight: "900"
  },
  error: {
    color: COLORS.danger,
    lineHeight: 20,
    fontWeight: "700"
  }
});
