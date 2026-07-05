import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { COLORS } from "../utils/constants";

export default function ScreenContainer({ children, scroll = true }) {
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>{content}</ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    padding: 20,
    gap: 18
  }
});
