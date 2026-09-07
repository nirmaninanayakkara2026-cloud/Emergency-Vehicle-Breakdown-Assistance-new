import React, { useCallback, useEffect, useState } from "react";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import ErrorState from "../../components/ui/ErrorState";
import LoadingState from "../../components/ui/LoadingState";
import { getMyProviderProfile } from "../../services/providerService";
import { useAuth } from "../../context/AuthContext";

export default function ProviderEntryScreen({ navigation }) {
  const { user } = useAuth();
  // Track profile lookup state before routing the provider to the correct screen.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Check profile setup and route by provider type or missing-profile status.
  const checkProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await getMyProviderProfile();
      navigation.replace(
        user?.role === "spare_parts_shop"
          ? "SparePartsShopDashboard"
          : "ProviderDashboard",
      );
    } catch (profileError) {
      if (profileError.message.toLowerCase().includes("not found")) {
        navigation.replace("ProviderProfile");
        return;
      }
      setError(profileError.message);
    } finally {
      setLoading(false);
    }
  }, [navigation, user?.role]);

  useEffect(() => {
    checkProfile();
  }, [checkProfile]);

  return (
    <ScreenContainer>
      <AppCard>
        {/* Entry loading state and profile lookup errors. */}
        {loading ? (
          <LoadingState message="Preparing your service dashboard..." />
        ) : null}
        {!loading && error ? (
          <ErrorState
            message="We couldn't load your provider profile."
            onRetry={checkProfile}
          />
        ) : null}
      </AppCard>
    </ScreenContainer>
  );
}
