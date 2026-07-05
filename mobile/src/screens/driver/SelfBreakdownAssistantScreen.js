import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import { troubleshootingGuides } from "../../data/troubleshootingGuides";
import { BREAKDOWN_TYPES, COLORS, VEHICLE_TYPES } from "../../utils/constants";

export default function SelfBreakdownAssistantScreen({ navigation }) {
  const [vehicleType, setVehicleType] = useState("car");
  const [breakdownType, setBreakdownType] = useState("flat_tyre");
  const [problemDescription, setProblemDescription] = useState("");
  const [guide, setGuide] = useState(null);

  function handleSubmit() {
    const selectedGuide =
      troubleshootingGuides.find((item) => item.breakdownType === breakdownType) ||
      troubleshootingGuides.find((item) => item.breakdownType === "other");
    setGuide(selectedGuide);
  }

  function handleRequestMechanic() {
    navigation.navigate("RequestMechanic", {
      prefill: {
        vehicleType,
        breakdownType,
        problemDescription
      }
    });
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Self Breakdown Assistant</Text>
      <Text style={styles.subtitle}>Local troubleshooting guide using mock app data.</Text>

      <AppCard>
        <AppSelect label="Vehicle type" options={VEHICLE_TYPES} value={vehicleType} onChange={setVehicleType} />
        <AppSelect label="Breakdown type" options={BREAKDOWN_TYPES} value={breakdownType} onChange={setBreakdownType} />
        <AppInput
          label="Problem description (optional)"
          value={problemDescription}
          onChangeText={setProblemDescription}
          placeholder="Add a short note"
          multiline
        />
        <AppButton title="Show Guide" onPress={handleSubmit} />
      </AppCard>

      {guide ? (
        <AppCard>
          <Text style={styles.cardTitle}>{guide.title}</Text>
          <Text style={styles.warning}>{guide.warning}</Text>
          <View style={styles.steps}>
            {guide.steps.map((step, index) => (
              <Text key={step} style={styles.step}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>
          <AppButton title="I Fixed It" variant="secondary" onPress={() => Alert.alert("Great", "Marked as fixed in mock UI.")} />
          <AppButton title="Request Mechanic" onPress={handleRequestMechanic} />
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  subtitle: {
    color: COLORS.muted
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  warning: {
    color: COLORS.danger,
    fontWeight: "800",
    lineHeight: 21
  },
  steps: {
    gap: 8
  },
  step: {
    color: COLORS.muted,
    lineHeight: 21
  }
});
