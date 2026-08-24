import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { PROVIDER_ROLES } from "../../utils/constants";
import { formatDisplayValue } from "../../utils/displayLabels";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("driver"); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const providerSelected = role !== "driver";

  async function handleRegister() {
    setError("");
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) return setError("All fields are required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try { await register({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, role }); }
    catch (registerError) { setError(registerError.message); }
    finally { setLoading(false); }
  }

  return (
    <ScreenContainer keyboard>
      <ScreenHeader eyebrow="Join RoadCare" title="Create your account" subtitle="Choose how you'll use the app, then add your details." />
      <View style={styles.roleRow}>
        <RoleCard icon="car-outline" title="Driver" description="Request roadside help" selected={!providerSelected} onPress={() => setRole("driver")} />
        <RoleCard icon="construct-outline" title="Service Provider" description="Respond to drivers" selected={providerSelected} onPress={() => setRole("mechanic")} />
      </View>
      {providerSelected ? <AppCard><Text style={styles.groupLabel}>Provider type</Text><View style={styles.chips}>{PROVIDER_ROLES.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: role === item }} onPress={() => setRole(item)} style={[styles.chip, role === item && styles.chipSelected]}><Text style={[styles.chipText, role === item && styles.chipTextSelected]}>{formatDisplayValue(item)}</Text>{role === item ? <Ionicons name="checkmark-circle" size={17} color={colors.teal} /> : null}</Pressable>)}</View></AppCard> : null}
      <AppCard style={styles.form}>
        <Text style={styles.groupLabel}>Account details</Text>
        <AppInput label="Full name" icon="person-outline" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
        <AppInput label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <AppInput label="Phone" icon="call-outline" value={phone} onChangeText={setPhone} placeholder="071 234 5678" keyboardType="phone-pad" autoComplete="tel" />
        <AppInput label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <AppInput label="Confirm password" icon="shield-checkmark-outline" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        <AppButton title="Create Account" icon="arrow-forward" onPress={handleRegister} loading={loading} />
        <AppButton title="Back to Sign In" variant="ghost" onPress={() => navigation.goBack()} />
      </AppCard>
    </ScreenContainer>
  );
}

function RoleCard({ icon, title, description, selected, onPress }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.roleCard, selected && styles.roleSelected]}><Ionicons name={icon} size={28} color={selected ? colors.teal : colors.textSecondary} /><Text style={styles.roleTitle}>{title}</Text><Text style={styles.roleDescription}>{description}</Text>{selected ? <Ionicons name="checkmark-circle" size={20} color={colors.teal} style={styles.check} /> : null}</Pressable>; }
const styles = StyleSheet.create({
  roleRow: { flexDirection: "row", gap: spacing.sm }, roleCard: { flex: 1, minHeight: 138, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs }, roleSelected: { borderColor: colors.teal, backgroundColor: colors.tealLight }, check: { position: "absolute", right: 12, top: 12 }, roleTitle: { ...typography.cardTitle, color: colors.textPrimary }, roleDescription: { ...typography.caption, color: colors.textSecondary }, form: { gap: spacing.md }, groupLabel: { ...typography.cardTitle, color: colors.primaryDark }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, chip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.sm }, chipSelected: { borderColor: colors.teal, backgroundColor: colors.tealLight }, chipText: { ...typography.caption, color: colors.textSecondary }, chipTextSelected: { color: colors.primaryDark, fontWeight: "600" }
});
