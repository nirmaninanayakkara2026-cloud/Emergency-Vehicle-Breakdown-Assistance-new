import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import SymptomChip from "../../components/symptom/SymptomChip";
import SymptomProgress from "../../components/symptom/SymptomProgress";
import SymptomQuestionCard from "../../components/symptom/SymptomQuestionCard";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { OBSERVED_SYMPTOM_GROUPS } from "../../data/symptomQuestionFlows";
import {
  buildStructuredSymptomPayload,
  getCurrentQuestion,
  getQuestionsForProblem,
  validateAnswer
} from "../../services/symptomCaptureService";
import { COLORS } from "../../utils/constants";
import { colors, radii, spacing, typography } from "../../theme";

const emptyObservedSymptoms = { see: [], hear: [], smell: [], feel: [] };
const observationIcons = { see: "eye-outline", hear: "ear-outline", smell: "flower-outline", feel: "hand-left-outline" };

export default function GuidedSymptomCaptureScreen({ navigation, route }) {
  const initialData = route.params?.initialData || {};
  const sourceRoute = route.params?.sourceRoute || "RequestMechanic";
  const vehicleType = initialData.vehicleType || route.params?.vehicleType || "car";
  const breakdownType = initialData.breakdownType || route.params?.breakdownType || "other";
  const questions = useMemo(() => getQuestionsForProblem(breakdownType), [breakdownType]);
  const [stepIndex, setStepIndex] = useState(0);
  const [symptoms, setSymptoms] = useState(initialData.symptoms || {});
  const [observedSymptoms, setObservedSymptoms] = useState({
    ...emptyObservedSymptoms,
    ...(initialData.observedSymptoms || {})
  });
  const [description, setDescription] = useState(initialData.description || "");
  const [error, setError] = useState("");
  const [activeObservation, setActiveObservation] = useState("see");

  const currentQuestion = getCurrentQuestion(questions, stepIndex);
  const observationStep = stepIndex === questions.length;
  const descriptionStep = stepIndex === questions.length + 1;
  const totalSteps = questions.length + 2;

  function updateAnswer(answer) {
    setError("");
    setSymptoms((current) => ({ ...current, [currentQuestion.id]: answer }));
  }

  function toggleObserved(groupKey, value) {
    setObservedSymptoms((current) => {
      const values = current[groupKey] || [];
      return {
        ...current,
        [groupKey]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value]
      };
    });
  }

  function goBack() {
    setError("");
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setStepIndex((current) => current - 1);
  }

  function goNext() {
    setError("");
    if (currentQuestion && !validateAnswer(currentQuestion, symptoms[currentQuestion.id])) {
      setError("Select the option that fits best. You can choose Not Sure.");
      return;
    }

    if (!descriptionStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    const structuredSymptoms = buildStructuredSymptomPayload({
      vehicleType,
      breakdownType,
      symptoms,
      observedSymptoms,
      description
    });
    navigation.navigate("SymptomSummary", { structuredSymptoms, sourceRoute });
  }

  const progressLabel = currentQuestion
    ? `Question ${stepIndex + 1} of ${questions.length}`
    : observationStep
      ? "Extra observations (optional)"
      : "Additional details (optional)";

  return (
    <ScreenContainer>
      <ScreenHeader eyebrow="Guided symptom capture" title="Help us understand" subtitle="Choose what you noticed. It is always okay to select Not Sure." />

      <SymptomProgress current={stepIndex + 1} total={totalSteps} label={progressLabel} />

      {currentQuestion ? (
        <SymptomQuestionCard
          question={currentQuestion}
          answer={symptoms[currentQuestion.id]}
          onAnswerChange={updateAnswer}
        />
      ) : null}

      {observationStep ? (
        <AppCard>
          <Text style={styles.cardTitle}>What else did you notice?</Text>
          <Text style={styles.help}>This is optional. Select as many as needed.</Text>
          <View style={styles.observationTabs}>{OBSERVED_SYMPTOM_GROUPS.map((group) => { const selected = activeObservation === group.key; return <Pressable key={group.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setActiveObservation(group.key)} style={[styles.observationTab, selected && styles.observationTabSelected]}><Ionicons name={observationIcons[group.key]} size={22} color={selected ? colors.teal : colors.textSecondary} /><Text style={[styles.observationLabel, selected && styles.observationLabelSelected]}>{group.label}</Text>{observedSymptoms[group.key].length ? <View style={styles.count}><Text style={styles.countText}>{observedSymptoms[group.key].length}</Text></View> : null}</Pressable>; })}</View>
          {OBSERVED_SYMPTOM_GROUPS.filter((group) => group.key === activeObservation).map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeading}><Ionicons name={observationIcons[group.key]} size={21} color={colors.teal} /><Text style={styles.groupLabel}>What did you {group.label.toLowerCase()}?</Text></View>
              <View style={styles.chips}>
                {group.options.map((option) => (
                  <SymptomChip
                    key={option.value}
                    label={option.label}
                    selected={observedSymptoms[group.key].includes(option.value)}
                    onPress={() => toggleObserved(group.key, option.value)}
                    style={styles.observationChoice}
                  />
                ))}
              </View>
            </View>
          ))}
        </AppCard>
      ) : null}

      {descriptionStep ? (
        <AppCard>
          <Text style={styles.cardTitle}>Anything else you want to tell us?</Text>
          <AppInput
            value={description}
            onChangeText={setDescription}
            placeholder="Tell us anything else you saw, heard, smelled or felt before the problem happened..."
            multiline
          />
          <Text style={styles.help}>Optional</Text>
        </AppCard>
      ) : null}

      {error ? <InfoBanner tone="warning" message={error} /> : null}
      <View style={styles.navigationRow}>
        <View style={styles.flex}>
          <AppButton title="Back" variant="secondary" onPress={goBack} />
        </View>
        <View style={styles.flex}>
          <AppButton title={descriptionStep ? "Review Summary" : "Next"} onPress={goNext} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: COLORS.muted,
    lineHeight: 21
  },
  cardTitle: {
    color: COLORS.primaryDark,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 27
  },
  help: {
    color: COLORS.muted,
    lineHeight: 20
  },
  group: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.tealLight
  },
  groupHeading: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  groupLabel: {
    ...typography.bodyStrong,
    color: colors.primaryDark
  },
  observationTabs: { flexDirection: "row", gap: spacing.xs },
  observationTab: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: spacing.xxs, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface },
  observationTabSelected: { borderColor: colors.teal, backgroundColor: colors.tealLight },
  observationLabel: { ...typography.caption, color: colors.textSecondary }, observationLabelSelected: { color: colors.primaryDark, fontWeight: "600" },
  count: { position: "absolute", top: 5, right: 5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" }, countText: { color: colors.surface, fontSize: 10, fontWeight: "700" },
  chips: {
    gap: spacing.xs
  },
  observationChoice: { width: "100%", backgroundColor: colors.surface },
  navigationRow: {
    flexDirection: "row",
    gap: 10
  },
  flex: {
    flex: 1
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
