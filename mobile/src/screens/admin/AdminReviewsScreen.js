import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import AppCard from "../../components/AppCard";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { getAdminReviews } from "../../services/adminService";
import { adminStyles, formatDate } from "./adminUi";
const ratings = [
  { label: "All", value: "" },
  ...[5, 4, 3, 2, 1].map((value) => ({
    label: `${value} stars`,
    value: String(value),
  })),
];
export default function AdminReviewsScreen() {
  const [rating, setRating] = useState("");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminReviews({ rating: rating || undefined });
      setReviews(data.reviews || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [rating]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <ScreenContainer>
      {/* Reviews page header and administration context. */}
      <ScreenHeader
        eyebrow="Administration"
        title="Reviews"
        subtitle="Read submitted ratings without silently modifying them."
      />
      {/* Filter reviews by star rating. */}
      <AppCard>
        <AppSelect
          label="Rating"
          options={ratings}
          value={rating}
          onChange={setRating}
        />
      </AppCard>
      {/* Feedback shown while reviews load or when loading fails. */}
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      {loading ? <LoadingState message="Loading reviews..." /> : null}
      {/* Review results with ratings, comments, and related users. */}
      {reviews.map((review) => (
        <AppCard key={review._id}>
          <Text style={styles.title}>
            {"★".repeat(review.rating)}
            {"☆".repeat(5 - review.rating)}
          </Text>
          <Text style={styles.body}>
            {review.comment || "No written comment"}
          </Text>
          <Text style={styles.body}>
            Provider: {review.providerId?.businessName || "Provider"}
          </Text>
          <Text style={styles.body}>
            Driver: {review.driverId?.name || "Driver"} ·{" "}
            {formatDate(review.createdAt)}
          </Text>
        </AppCard>
      ))}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create(adminStyles);
