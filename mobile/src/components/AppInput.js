import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

export default function AppInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, error, icon, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, focused && styles.focused, error && styles.invalid, multiline && styles.multilineShell]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.teal : colors.muted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.multiline]}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "600"
  },
  inputShell: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md
  },
  focused: { borderColor: colors.teal, borderWidth: 1.5 },
  invalid: { borderColor: colors.danger },
  input: {
    flex: 1,
    minHeight: 50,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 16
  },
  multilineShell: { alignItems: "flex-start", minHeight: 104 },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  error: { ...typography.caption, color: colors.danger }
});
