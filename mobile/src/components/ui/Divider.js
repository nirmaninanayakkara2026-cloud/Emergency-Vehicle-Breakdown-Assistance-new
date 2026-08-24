import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";
export default function Divider() { return <View style={styles.divider} />; }
const styles = StyleSheet.create({ divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xxs } });
