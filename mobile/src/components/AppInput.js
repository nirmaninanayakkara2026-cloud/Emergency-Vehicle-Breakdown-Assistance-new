import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

export default function AppInput({ label, value, onChangeText, placeholder, secureTextEntry, showPasswordToggle = false, keyboardType, multiline, error, icon, ...props }) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, focused && styles.focused, error && styles.invalid, multiline && styles.multilineShell]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.teal : colors.muted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry && !(showPasswordToggle && passwordVisible)}
          keyboardType={keyboardType}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.multiline]}
          {...props}
        />
        {secureTextEntry && showPasswordToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={styles.passwordToggle}
          >
            <Ionicons
              name={passwordVisible ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
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
  passwordToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
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
