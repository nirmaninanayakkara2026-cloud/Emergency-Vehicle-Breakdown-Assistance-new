import { colors } from "../../theme";

export function approvalTone(status) {
  return { pending: "warning", approved: "success", rejected: "danger", suspended: "danger" }[status] || "neutral";
}

export function titleCase(value) {
  return String(value || "Not available").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "Not available";
}

export const adminStyles = {
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  stat: { width: "48%", minHeight: 110, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "space-between" },
  statValue: { fontSize: 26, fontWeight: "900", color: colors.primaryDark },
  statLabel: { color: colors.textSecondary, fontWeight: "700" },
  title: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  body: { color: colors.textSecondary, lineHeight: 21 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }
};
