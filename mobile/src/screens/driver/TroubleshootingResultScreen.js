import React, { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import { troubleshootingGuides } from "../../data/troubleshootingGuides";
import { saveTroubleshootingHistory } from "../../services/troubleshootingService";
import { COLORS } from "../../utils/constants";

export default function TroubleshootingResultScreen({ navigation, route }) {
  const {
    guideId,
    vehicleType,
    breakdownType,
    requestBreakdownType,
    problemDescription,
    serviceType,
    symptomData
  } = route.params || {};
  const guide = troubleshootingGuides.find((item) => item.id === guideId);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const requestPrefill = useMemo(
    () => ({
      vehicleType,
      breakdownType: requestBreakdownType || breakdownType,
      problemDescription: [
        symptomData ? "" : problemDescription,
        "Self-troubleshooting attempted",
        serviceType ? `Suggested service type: ${serviceType}` : ""
      ].filter(Boolean).join("\n"),
      requiredServiceType: serviceType,
      selfTroubleshootingAttempted: true,
      guidedSymptoms: symptomData
    }),
    [vehicleType, breakdownType, requestBreakdownType, problemDescription, serviceType, symptomData]
  );

  async function saveResult(nextResult) {
    setError("");
    try {
      await saveTroubleshootingHistory({
        vehicleType,
        breakdownType,
        riskLevel: guide?.riskLevel || "high",
        result: nextResult
      });
      setResult(nextResult);
    } catch (historyError) {
      setError("Could not save local self-assistance history.");
      setResult(nextResult);
    }
  }

  function handleRequestMechanic() {
    navigation.navigate("RequestMechanic", { prefill: requestPrefill });
  }

  return (
    <ScreenContainer>
      <AppCard>
        <Text style={styles.title}>Did this solve the problem?</Text>
        <Text style={styles.body}>{guide?.title || "Self-assistance guide completed."}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!result ? (
          <>
            <AppButton title="YES - Problem Fixed" variant="success" onPress={() => saveResult("resolved")} />
            <AppButton title="NO - I Still Need Help" onPress={() => saveResult("mechanic_requested")} />
          </>
        ) : null}

        {result === "resolved" ? (
          <>
            <Text style={styles.success}>Problem marked as resolved.</Text>
            <AppButton title="Return Home" onPress={() => navigation.navigate("DriverHome")} />
          </>
        ) : null}

        {result === "mechanic_requested" ? (
          <>
            <Text style={styles.warning}>Professional assistance is recommended.</Text>
            <AppButton title="Request Mechanic" onPress={handleRequestMechanic} />
            <AppButton title="Return Home" variant="secondary" onPress={() => navigation.navigate("DriverHome")} />
          </>
        ) : null}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21
  },
  success: {
    color: COLORS.success,
    fontWeight: "900"
  },
  warning: {
    color: COLORS.warning,
    fontWeight: "900"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
