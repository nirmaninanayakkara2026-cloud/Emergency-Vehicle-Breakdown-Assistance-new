import { StyleSheet, Text } from "react-native";

import { defaultColors } from "../utils/colors";

export default function Message({ children, colors = defaultColors, type = "error" }) {
  if (!children) return null;
  return <Text style={[styles.text, { color: type === "error" ? colors.danger : colors.success }]}>{children}</Text>;
}

const styles = StyleSheet.create({ text: { fontSize: 14, marginBottom: 10 } });
