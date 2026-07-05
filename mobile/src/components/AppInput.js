import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../utils/constants";

export default function AppInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={COLORS.muted}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6
  },
  label: {
    color: COLORS.text,
    fontWeight: "700"
  },
  input: {
    minHeight: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 16
  },
  multiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top"
  }
});
