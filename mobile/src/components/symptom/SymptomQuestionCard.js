import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppCard from "../AppCard";
import { colors, spacing, typography } from "../../theme";
import SymptomChip from "./SymptomChip";

export default function SymptomQuestionCard({ question, answer, onAnswerChange }) {
  const selectedValues = Array.isArray(answer) ? answer : [];
// Handle selection of an option based on the question type (single or multi-choice).
  function selectOption(value) {
    if (question.type !== "multi_choice") {
      onAnswerChange(value);
      return;
    }
// For multi-choice questions, handle the selection logic, including special cases for "none" and "not_sure".
    if (value === "none" || value === "not_sure") {
      onAnswerChange(selectedValues.includes(value) ? [] : [value]);
      return;
    }
// Filter out "none" and "not_sure" from the selected values and update the answer accordingly.
    const withoutUncertainValues = selectedValues.filter(
      (item) => item !== "none" && item !== "not_sure"
    );
    onAnswerChange(
      withoutUncertainValues.includes(value)
        ? withoutUncertainValues.filter((item) => item !== value)
        : [...withoutUncertainValues, value]
    );
  }

  return (
    <AppCard>
      <Text style={styles.question}>{question.question}</Text>
      {question.type === "multi_choice" ? (
        <Text style={styles.help}>Select all that apply.</Text>
      ) : null}
      <View style={styles.options}>
        {question.options.map((option) => {
          const selected = Array.isArray(answer)
            ? answer.includes(option.value)
            : answer === option.value;
          return (
            <SymptomChip
              key={option.value}
              label={option.label}
              selected={selected}
              onPress={() => selectOption(option.value)}
            />
          );
        })}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  question: {
    ...typography.sectionTitle,
    color: colors.primaryDark
  },
  help: {
    ...typography.body,
    color: colors.textSecondary
  },
  options: {
    gap: spacing.sm
  }
});
