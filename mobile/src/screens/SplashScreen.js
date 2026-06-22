import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// Change this page's colors here.
const SCREEN_COLORS = { background: "#EAF4F7", primary: "#176B87", text: "#17324D" };

export default function SplashScreen() {
  return (
    <View style={[styles.container, { backgroundColor: SCREEN_COLORS.background }]}>
      <Text style={[styles.title, { color: SCREEN_COLORS.text }]}>Emergency Assistance</Text>
      <ActivityIndicator color={SCREEN_COLORS.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, gap: 24, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
});
