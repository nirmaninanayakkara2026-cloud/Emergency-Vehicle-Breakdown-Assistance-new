import { StyleSheet, View } from "react-native";

import { defaultColors } from "../utils/colors";

export default function AppCard({ children, colors = defaultColors, style }) {
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 14, padding: 16 },
});
