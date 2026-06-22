import { StyleSheet, Text, TextInput, View } from "react-native";

import { defaultColors } from "../utils/colors";

export default function FormInput({ label, colors = defaultColors, multiline = false, ...props }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 },
  multiline: { minHeight: 110, textAlignVertical: "top" },
});
