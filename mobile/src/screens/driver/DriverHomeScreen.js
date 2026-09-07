import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import EmptyState from "../../components/ui/EmptyState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { getMyRequests } from "../../services/requestService";
import { colors, radii, shadows, spacing, typography } from "../../theme";
import {
  formatDisplayValue,
  formatFaultLabel,
} from "../../utils/displayLabels";

export default function DriverHomeScreen({ navigation }) {
  //validate user is logged in
  const { user } = useAuth();
  // current time of day.
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const [recentRequest, setRecentRequest] = useState(null);
  // Refresh the driver's latest active request whenever this screen gains focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMyRequests()
        .then((items) => {
          if (!active) return;
          const current = items.find(
            (item) =>
              !["completed", "cancelled", "provider_rejected"].includes(
                item.status,
              ),
          );
          setRecentRequest(current || null);
        })
        .catch(() => {
          if (active) setRecentRequest(null);
        });
      return () => {
        active = false;
      };
    }, []),
  );
  return (
    <ScreenContainer>
      {/* Personalized header with profile navigation. */}
      <View style={styles.topRow}>
        <ScreenHeader
          eyebrow={`${greeting}, ${user?.name?.split(" ")[0] || "Driver"}`}
          title="How can we help?"
          subtitle="Get roadside assistance or try safe self-checks."
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => navigation.navigate("Profile")}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(user?.name || "D").slice(0, 1).toUpperCase()}
          </Text>
        </Pressable>
      </View>
      {/* Primary roadside assistance request action. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("RequestMechanic")}
        style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
      >
        <View style={styles.largeIcon}>
          <Ionicons name="construct" size={30} color={colors.primary} />
        </View>
        <View style={styles.featureCopy}>
          <Text style={styles.primaryTitle}>Request Mechanic</Text>
          <Text style={styles.primaryBody}>
            Find the right nearby service for your vehicle problem.
          </Text>
        </View>
        <Ionicons
          name="arrow-forward-circle"
          size={30}
          color={colors.surface}
        />
      </Pressable>
      {/* Safety-aware self-troubleshooting action. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("SelfBreakdownAssistant")}
        style={({ pressed }) => [
          styles.secondaryCard,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.tealIcon}>
          <Ionicons name="shield-checkmark" size={28} color={colors.teal} />
        </View>
        <View style={styles.featureCopy}>
          <Text style={styles.secondaryTitle}>Self Breakdown Assistant</Text>
          <Text style={styles.secondaryBody}>
            Try guided and safety-aware checks for suitable issues.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.teal} />
      </Pressable>
      {/* Latest active request and request history link. */}
      <View style={styles.section}>
        <SectionHeader
          title="Recent Activity"
          action={
            <Pressable onPress={() => navigation.navigate("MyRequests")}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          }
        />
        {recentRequest ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("RequestDetails", {
                requestId: recentRequest._id,
              })
            }
          >
            <AppCard>
              <View style={styles.activityTop}>
                <View style={styles.activityIcon}>
                  <Ionicons
                    name="car-sport-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.activityTitle}>
                    {formatFaultLabel(
                      recentRequest.aiPrediction?.predictedFault,
                      recentRequest.aiPrediction?.faultLabel ||
                        formatDisplayValue(recentRequest.breakdownType),
                    )}
                  </Text>
                  <Text style={styles.activityMeta}>
                    {formatDisplayValue(recentRequest.vehicleType)} ·{" "}
                    {new Date(recentRequest.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <StatusBadge
                  status={recentRequest.status}
                  tone={
                    recentRequest.status === "completed" ? "success" : "info"
                  }
                />
              </View>
            </AppCard>
          </Pressable>
        ) : (
          <AppCard>
            <EmptyState
              title="No active requests"
              message="You don't have an active roadside request."
              icon="car-outline"
              actionLabel="View Request History"
              onAction={() => navigation.navigate("MyRequests")}
            />
          </AppCard>
        )}
      </View>
      {/* Shortcuts to requests, spare parts, and the driver profile. */}
      <View style={styles.quickRow}>
        <QuickAction
          icon="receipt-outline"
          label="Requests"
          onPress={() => navigation.navigate("MyRequests")}
        />
        <QuickAction
          icon="cog-outline"
          label="Spare Parts"
          onPress={() => navigation.navigate("SparePartsFinder")}
        />
        <QuickAction
          icon="person-outline"
          label="Profile"
          onPress={() => navigation.navigate("Profile")}
        />
      </View>
    </ScreenContainer>
  );
}

// Reusable shortcut button for the home screen navigation row.
function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.quick}
    >
      <Ionicons name={icon} size={23} color={colors.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.tealLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.cardTitle, color: colors.teal },
  primaryCard: {
    minHeight: 154,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    ...shadows.floating,
  },
  largeIcon: {
    width: 58,
    height: 58,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: { flex: 1, gap: spacing.xs },
  primaryTitle: { ...typography.sectionTitle, color: colors.surface },
  primaryBody: { ...typography.body, color: "#DCE8F0" },
  secondaryCard: {
    minHeight: 132,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.teal,
    ...shadows.card,
  },
  tealIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.tealLight,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryTitle: { ...typography.cardTitle, color: colors.primaryDark },
  secondaryBody: { ...typography.body, color: colors.textSecondary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  section: { gap: spacing.sm },
  link: { ...typography.bodyStrong, color: colors.teal },
  activityTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  activityMeta: { ...typography.caption, color: colors.textSecondary },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quick: {
    flex: 1,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
