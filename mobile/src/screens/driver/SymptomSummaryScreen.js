import React, { useMemo, useRef, useState } from "react";
import AppButton from "../../components/AppButton";
import ScreenContainer from "../../components/ScreenContainer";
import SymptomSummaryCard from "../../components/symptom/SymptomSummaryCard";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { buildSymptomSummary } from "../../services/symptomCaptureService";
import { startSelfAssistant } from "../../services/selfAssistantService";
import InfoBanner from "../../components/ui/InfoBanner";
import { buildSelfAssistantPayload, routeSelfAssistantResponse } from "../../utils/selfAssistantFlow";

export default function SymptomSummaryScreen({ navigation, route }) {
  const structuredSymptoms = route.params?.structuredSymptoms;
  const sourceRoute = route.params?.sourceRoute || "RequestMechanic";
  const selfAssistantSource = sourceRoute === "SelfBreakdownAssistant";
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const processingRef = useRef(false);
  const summary = useMemo(
    () => buildSymptomSummary(structuredSymptoms || {}),
    [structuredSymptoms]
  );

  async function continueToSource() {
    if (!selfAssistantSource) {
      navigation.popTo(sourceRoute, { guidedSymptoms: structuredSymptoms });
      return;
    }
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setError("");
    const payload = buildSelfAssistantPayload(structuredSymptoms);
    try {
      const response = await startSelfAssistant(payload);
      routeSelfAssistantResponse(navigation, response, payload, { replace: true, resetFlow: true });
    } catch (_processingError) {
      setError("We couldn't check your updated symptoms. Please try again.");
      processingRef.current = false;
      setProcessing(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader eyebrow="Review" title="What We Understood" subtitle="Check these details before continuing. You can correct any answer." />
      <SymptomSummaryCard summary={summary} />
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      <AppButton title="Edit Answers" icon="create-outline" variant="secondary" disabled={processing} onPress={() => navigation.goBack()} />
      <AppButton title={selfAssistantSource ? "Use These Symptoms and Continue" : "Continue"} icon="arrow-forward" loading={processing} disabled={processing} onPress={continueToSource} />
    </ScreenContainer>
  );
}
