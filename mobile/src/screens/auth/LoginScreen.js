import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  // Store the form values and request state for the login flow.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Validate the form and submit credentials through the auth context.
  async function handleLogin() {
    setError("");
    if (!email.trim() || !password)
      return setError("Email and password are required.");
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer keyboard contentStyle={styles.screen}>
      {/* Welcome branding and roadside assistance introduction. */}
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="car-sport" size={34} color={colors.surface} />
        </View>
        <Text style={styles.brand}>RoadCare</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue to roadside assistance.
        </Text>
      </View>
      {/* Login form, validation feedback, and registration navigation. */}
      <AppCard style={styles.form}>
        <AppInput
          label="Email"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <AppInput
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
        />
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        <AppButton
          title="Sign In"
          icon="arrow-forward"
          onPress={handleLogin}
          loading={loading}
        />
        <View style={styles.createRow}>
          <Text style={styles.createText}>Don't have an account?</Text>
          <AppButton
            title="Create account"
            variant="ghost"
            compact
            onPress={() => navigation.navigate("Register")}
          />
        </View>
      </AppCard>
      {/* Security reassurance displayed below the form. */}
      <View style={styles.trust}>
        <Ionicons
          name="shield-checkmark-outline"
          size={18}
          color={colors.teal}
        />
        <Text style={styles.trustText}>Secure help when you need it most</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  hero: { alignItems: "center", gap: spacing.xs },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  brand: {
    ...typography.caption,
    color: colors.teal,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { ...typography.pageTitle, color: colors.primaryDark },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  form: { gap: spacing.md },
  createRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  createText: { ...typography.body, color: colors.textSecondary },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  trustText: { ...typography.caption, color: colors.textSecondary },
});
