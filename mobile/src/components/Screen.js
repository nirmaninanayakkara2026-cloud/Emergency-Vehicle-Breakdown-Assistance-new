import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet } from "react-native";

import { defaultColors } from "../utils/colors";

export default function Screen({ children, colors = defaultColors, scroll = true }) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : children;

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: 20 },
});
