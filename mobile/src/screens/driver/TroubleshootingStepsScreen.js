import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import RiskLevelCard from "../../components/RiskLevelCard";
import ScreenContainer from "../../components/ScreenContainer";
import TroubleshootingStepCard from "../../components/TroubleshootingStepCard";
import { troubleshootingGuides } from "../../data/troubleshootingGuides";
import { saveTroubleshootingHistory } from "../../services/troubleshootingService";
import { COLORS } from "../../utils/constants";

function formatValue(value) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

export default function TroubleshootingStepsScreen({ navigation, route }) {
  // Read the selected guide context and track step completion.
  const {
    guideId,
    vehicleType,
    breakdownType,
    requestBreakdownType,
    problemDescription,
    serviceType,
    symptomData,
  } = route.params || {};
  const guide = troubleshootingGuides.find((item) => item.id === guideId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  const completedCount = completedSteps.length;
  const currentStep = guide?.steps?.[currentIndex];
  const isLastStep = guide && currentIndex === guide.steps.length - 1;

  // Preserve troubleshooting context for a mechanic request.
  const requestPrefill = useMemo(
    () => ({
      vehicleType,
      breakdownType: requestBreakdownType || breakdownType,
      problemDescription: [
        symptomData ? "" : problemDescription,
        "Self-troubleshooting attempted",
        serviceType ? `Suggested service type: ${serviceType}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      requiredServiceType: serviceType,
      selfTroubleshootingAttempted: true,
      guidedSymptoms: symptomData,
    }),
    [
      vehicleType,
      breakdownType,
      requestBreakdownType,
      problemDescription,
      serviceType,
      symptomData,
    ],
  );

  // Save the escalation outcome before opening a mechanic request.
  async function handleStopAndRequestMechanic() {
    try {
      await saveTroubleshootingHistory({
        vehicleType,
        breakdownType,
        riskLevel: guide?.riskLevel || "high",
        result: "mechanic_requested",
      });
    } catch (historyError) {
      // Continue to mechanic request even if local history fails.
    }

    navigation.navigate("RequestMechanic", { prefill: requestPrefill });
  }

  // Save the cancelled outcome before returning to the driver home screen.
  async function handleReturnHome() {
    try {
      await saveTroubleshootingHistory({
        vehicleType,
        breakdownType,
        riskLevel: guide?.riskLevel || "high",
        result: "cancelled",
      });
    } catch (historyError) {
      // Returning home should not be blocked by local storage.
    }
    navigation.navigate("DriverHome");
  }

  // Toggle completion for the currently displayed troubleshooting step.
  function toggleCompleted() {
    const stepId = currentStep.id;
    setCompletedSteps((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId],
    );
  }

  // Move to the next step or open the result screen after the final step.
  function goNext() {
    if (isLastStep) {
      navigation.navigate("TroubleshootingResult", {
        guideId,
        vehicleType,
        breakdownType,
        requestBreakdownType,
        problemDescription,
        serviceType,
        symptomData,
      });
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  if (!guide || guide.riskLevel === "high" || !currentStep) {
    return (
      <ScreenContainer>
        {/* Fallback when no safe guide is available. */}
        <AppCard>
          <Text style={styles.title}>Guide unavailable</Text>
          <Text style={styles.body}>
            We do not currently have a safe self-assistance guide for this
            problem.
          </Text>
          <AppButton
            title="Request Mechanic"
            onPress={handleStopAndRequestMechanic}
          />
          <AppButton
            title="Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        </AppCard>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Guide title, risk level, and progress summary. */}
      <Text style={styles.title}>{guide.title}</Text>
      <RiskLevelCard riskLevel={guide.riskLevel} />

      <AppCard>
        <Text style={styles.progress}>
          {completedCount} / {guide.steps.length} steps completed
        </Text>
        <Text style={styles.body}>
          Category: {formatValue(guide.breakdownType)}
        </Text>
      </AppCard>

      {/* Safety conditions that require immediate professional assistance. */}
      {guide.stopConditions?.length ? (
        <AppCard style={styles.stopCard}>
          <Text style={styles.stopTitle}>
            Stop immediately and request professional assistance if you notice:
          </Text>
          {guide.stopConditions.map((item) => (
            <Text key={item} style={styles.stopText}>
              - {item}
            </Text>
          ))}
          <AppButton
            title="Stop & Request Mechanic"
            variant="danger"
            onPress={handleStopAndRequestMechanic}
          />
        </AppCard>
      ) : null}

      {/* Current troubleshooting step and completion control. */}
      <TroubleshootingStepCard
        step={currentStep}
        stepNumber={currentIndex + 1}
        totalSteps={guide.steps.length}
        completed={completedSteps.includes(currentStep.id)}
        onCompleted={toggleCompleted}
      />

      {/* Step navigation and final escalation actions. */}
      <View style={styles.navRow}>
        <View style={styles.flex}>
          <AppButton
            title="Previous"
            variant="secondary"
            disabled={currentIndex === 0}
            onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          />
        </View>
        <View style={styles.flex}>
          <AppButton title={isLastStep ? "Finish" : "Next"} onPress={goNext} />
        </View>
      </View>
      <AppButton
        title="Stop & Request Mechanic"
        variant="danger"
        onPress={handleStopAndRequestMechanic}
      />
      <AppButton
        title="Return Home"
        variant="secondary"
        onPress={handleReturnHome}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900",
  },
  body: {
    color: COLORS.muted,
    lineHeight: 21,
    textTransform: "capitalize",
  },
  progress: {
    color: COLORS.primaryDark,
    fontWeight: "900",
  },
  stopCard: {
    borderColor: COLORS.danger,
    backgroundColor: "#fff5f5",
  },
  stopTitle: {
    color: COLORS.danger,
    fontWeight: "900",
    lineHeight: 20,
  },
  stopText: {
    color: COLORS.text,
    lineHeight: 20,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
});
