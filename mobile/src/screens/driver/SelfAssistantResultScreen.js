import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import { setSessionResult } from "../../services/selfAssistantService";
import { colors, radii, spacing, typography } from "../../theme";
import { formatFaultLabel, formatServiceType } from "../../utils/displayLabels";

export default function SelfAssistantResultScreen({ navigation, route }) {
  // Read the self-assistant outcome and track result-saving state.
  const {
    sessionId,
    session,
    aiPrediction,
    prefill,
    status,
    message,
    recommendedService,
    riskLevel,
  } = route.params || {};
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const completed = status === "resolved";
  const confirmedResolved = completed && session?.status === "resolved";
  const unavailable = status === "troubleshooting_unavailable";
  const service = recommendedService || session?.recommendedService;
  // Save whether troubleshooting resolved the issue or route to professional help.
  async function recordResult(resolved) {
    setSaving(true);
    setError("");
    try {
      const response = sessionId ? await setSessionResult(sessionId, resolved) : null;
      if (response?.status === "in_progress") {
        navigation.replace("TroubleshootingConversation", {
          sessionId, session: response.session, currentStep: response.currentStep,
          currentPhase: response.currentPhase, prefill, aiPrediction, riskLevel,
        });
      } else if (resolved) navigation.navigate("DriverHome");
      else navigation.navigate("RequestMechanic", { prefill });
    } catch (resultError) {
      setError(resultError.message);
    } finally {
      setSaving(false);
    }
  }
  // Display the troubleshooting outcome, safety guidance, and next actions.
  return (
    <ScreenContainer contentStyle={styles.screen}>
      <AppCard style={completed ? styles.completeCard : styles.warningCard}>
        <View
          style={[
            styles.icon,
            completed ? styles.completeIcon : styles.warningIcon,
          ]}
        >
          <Ionicons
            name={completed ? "checkmark" : "shield"}
            size={40}
            color={completed ? colors.green : colors.danger}
          />
        </View>
        <Text
          style={[
            styles.title,
            { color: completed ? colors.green : colors.danger },
          ]}
        >
          {completed
            ? confirmedResolved ? "Problem Resolved" : "Basic Troubleshooting Complete"
            : unavailable
              ? "Self-Troubleshooting Unavailable"
              : "Professional Assistance Recommended"}
        </Text>
        <Text style={styles.body}>
          {message ||
            (unavailable
              ? "Self-troubleshooting is temporarily unavailable."
              : "This issue may be unsafe to troubleshoot without professional help.")}
        </Text>
        {aiPrediction?.faultLabel ? (
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>Possible problem</Text>
            <Text style={styles.detailValue}>
              {formatFaultLabel(
                aiPrediction.predictedFault,
                aiPrediction.faultLabel,
              )}
            </Text>
          </View>
        ) : null}
        {service && !completed ? (
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>Recommended help</Text>
            <Text style={styles.detailValue}>{formatServiceType(service)}</Text>
          </View>
        ) : null}
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        {confirmedResolved ? (
          <AppButton title="Return Home" variant="success" onPress={() => navigation.navigate("DriverHome")} />
        ) : completed ? (
          <>
            <Text style={styles.body}>
              That completes the basic troubleshooting steps.
            </Text>
            <Text style={styles.question}>
              Is the vehicle problem now resolved?
            </Text>
            <AppButton
              title="Yes – Problem Resolved"
              icon="checkmark-circle-outline"
              variant="success"
              loading={saving}
              onPress={() => recordResult(true)}
            />
            <AppButton
              title="No – I Still Need Help"
              icon="construct-outline"
              loading={saving}
              onPress={() => recordResult(false)}
            />
          </>
        ) : (
          <>
            <AppButton
              title="Request Mechanic"
              icon="construct-outline"
              onPress={() =>
                navigation.navigate("RequestMechanic", { prefill })
              }
            />
            <AppButton
              title="Return Home"
              variant="ghost"
              onPress={() => navigation.navigate("DriverHome")}
            />
          </>
        )}
      </AppCard>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  warningCard: {
    borderColor: "#F5CACA",
    backgroundColor: colors.dangerLight,
    alignItems: "stretch",
  },
  completeCard: {
    borderColor: "#BFE9D0",
    backgroundColor: colors.greenLight,
    alignItems: "stretch",
  },
  icon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  completeIcon: { backgroundColor: colors.surface },
  warningIcon: { backgroundColor: colors.surface },
  title: { ...typography.pageTitle, textAlign: "center" },
  body: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  detail: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  detailLabel: { ...typography.caption, color: colors.textSecondary },
  detailValue: { ...typography.bodyStrong, color: colors.textPrimary },
  question: {
    ...typography.cardTitle,
    color: colors.primaryDark,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
