import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import ErrorState from "../../components/ui/ErrorState";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import {
  getRequestById,
  submitRequestReview,
} from "../../services/requestService";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatDisplayValue,
  formatFaultLabel,
  formatServiceType,
} from "../../utils/displayLabels";

const money = (value) => `LKR ${Number(value || 0).toLocaleString()}`;
const completedDate = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Completion time unavailable";

export default function JobCompletionScreen({ navigation, route }) {
  // Load the completed request and track review form state.
  const requestId = route.params?.requestId || route.params?.request?._id;
  const [request, setRequest] = useState(route.params?.request || null);
  const [loading, setLoading] = useState(!route.params?.request);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [thankYou, setThankYou] = useState(false);
  // Fetch the request and redirect if the service is not completed yet.
  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getRequestById(requestId);
      if (data.status !== "completed") {
        navigation.replace("RequestTracking", { requestId, request: data });
        return;
      }
      setRequest(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [navigation, requestId]);
  useEffect(() => {
    load();
  }, [load]);
  // Validate and submit the driver's service rating and written review.
  async function submitReview() {
    if (!rating) {
      setError("Please select a rating from 1 to 5 stars.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitRequestReview(requestId, rating, comment.trim());
      setThankYou(true);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }
  if (loading || !request)
    return (
      <ScreenContainer>
        <LoadingState message="Loading completed service..." />
      </ScreenContainer>
    );
  const provider =
    request.selectedProviderId || request.currentAssignmentId?.providerId;
  const review = request.review;
  return (
    <ScreenContainer>
      {/* Completion confirmation and page heading. */}
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={44} color={colors.surface} />
      </View>
      <ScreenHeader
        eyebrow="Job completed"
        title="Service Completed"
        subtitle="Your roadside service has been completed."
      />
      {/* Request loading or review submission error feedback. */}
      {error ? (
        <AppCard>
          <ErrorState message={error} onRetry={load} />
        </AppCard>
      ) : null}
      {/* Completed service, provider, vehicle, and issue summary. */}
      <AppCard>
        <Text style={styles.cardTitle}>Completion Summary</Text>
        <Summary
          label="Provider"
          value={provider?.businessName || "Provider information unavailable"}
        />
        <Summary
          label="Service"
          value={formatServiceType(request.requiredServiceType)}
        />
        <Summary
          label="Vehicle"
          value={formatDisplayValue(request.vehicleType)}
        />
        <Summary
          label="Possible Problem"
          value={formatFaultLabel(
            request.aiPrediction?.predictedFault,
            request.aiPrediction?.faultLabel ||
              formatDisplayValue(request.breakdownType),
          )}
        />
        <Summary label="Completed" value={completedDate(request.completedAt)} />
        {request.completionNote ? (
          <Summary label="Completion Note" value={request.completionNote} />
        ) : null}
      </AppCard>
      {/* Final price and original estimate range. */}
      <AppCard style={styles.priceCard}>
        <Text style={styles.priceLabel}>Final Service Price</Text>
        <Text style={styles.price}>{money(request.finalCost)}</Text>
        {request.estimatedCostRange ? (
          <Text style={styles.estimate}>
            Estimated Range: {money(request.estimatedCostRange.min)} –{" "}
            {money(request.estimatedCostRange.max)}
          </Text>
        ) : null}
      </AppCard>
      {/* Review confirmation after a successful submission. */}
      {thankYou ? (
        <InfoBanner
          tone="success"
          title="Thank you for your feedback!"
          message="Your rating has been added to this completed service."
        />
      ) : null}
      {/* New review form or previously submitted review details. */}
      {!review ? (
        <AppCard>
          <Text style={styles.cardTitle}>How was your service?</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={`${value} stars`}
                accessibilityState={{ selected: rating === value }}
                onPress={() => setRating(value)}
                style={styles.star}
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={34}
                  color={colors.amber}
                />
              </Pressable>
            ))}
          </View>
          <AppInput
            label="Tell us about your experience"
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Write a short review..."
            maxLength={500}
          />
          <AppButton
            title="Submit Review"
            loading={submitting}
            onPress={submitReview}
          />
          <AppButton
            title="Rate Later"
            variant="ghost"
            onPress={() => navigation.popToTop()}
          />
        </AppCard>
      ) : (
        <AppCard>
          <Text style={styles.cardTitle}>Your Rating</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Ionicons
                key={value}
                name={value <= review.rating ? "star" : "star-outline"}
                size={28}
                color={colors.amber}
              />
            ))}
          </View>
          <Text style={styles.label}>Your Review</Text>
          <Text style={styles.value}>
            {review.comment || "No written review."}
          </Text>
        </AppCard>
      )}
      {/* Navigation after reviewing or acknowledging the completed service. */}
      {review || thankYou ? (
        <>
          <AppButton
            title="Back to Home"
            onPress={() => navigation.popToTop()}
          />
          <AppButton
            title="View Service History"
            variant="secondary"
            onPress={() => navigation.navigate("MyRequests")}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

// Reusable label/value row for the completion summary.
function Summary({ label, value }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  successIcon: {
    alignSelf: "center",
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  cardTitle: { ...typography.sectionTitle, color: colors.primaryDark },
  summary: {
    gap: 3,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.bodyStrong, color: colors.textPrimary },
  priceCard: {
    alignItems: "center",
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  priceLabel: { ...typography.bodyStrong, color: colors.textSecondary },
  price: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    color: colors.green,
  },
  estimate: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  stars: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  star: {
    minWidth: 50,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
});
