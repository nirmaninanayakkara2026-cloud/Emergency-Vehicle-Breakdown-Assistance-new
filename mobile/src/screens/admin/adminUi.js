import { colors } from "../../theme";
//change  admin statuses to tones for UI display
export function approvalTone(status) {
  return { pending: "warning", approved: "success", rejected: "danger", suspended: "danger" }[status] || "neutral";
}
//formats text, such as spare_parts → Spare Parts
export function titleCase(value) {
  return String(value || "Not available").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
//displays a date in the device’s local format, or “Not available” when missing.
export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "Not available";
}

export const adminStyles = {
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  //styles each statistics card
  stat: { width: "48%", minHeight: 110, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  //styles the main statistic number
  statValue: { fontSize: 26, fontWeight: "900", color: colors.primaryDark },
  statLabel: { color: colors.textSecondary, fontWeight: "700" },
  //styles headings
  title: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  //styles body text
  body: { color: colors.textSecondary, lineHeight: 21 },
  //styles rows
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  //styles action buttons
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }
};
