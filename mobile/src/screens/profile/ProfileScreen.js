import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import Divider from "../../components/ui/Divider";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../utils/constants";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDisplayValue } from "../../utils/displayLabels";

function formatRole(role) {
  return role ? role.replaceAll("_", " ") : "driver";
}

export default function ProfileScreen() {
  const { user, logout, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
  }, [user]);

  async function handleSave() {
    setError("");
    setMessage("");

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Name, email, and phone are required.");
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim()
      });
      setMessage("Profile updated successfully.");
      setIsEditing(false);
    } catch (profileError) {
      setError(profileError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader eyebrow="Your account" title="Profile" subtitle="Manage your contact details and account." />
      <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || "U").slice(0, 1).toUpperCase()}</Text></View><Text style={styles.name}>{user?.name || "Account User"}</Text><Text style={styles.role}>{formatDisplayValue(user?.role || "driver")}</Text></View>

      <AppCard>
        {isEditing ? (
          <>
            <AppInput label="Name" value={name} onChangeText={setName} />
            <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </>
        ) : (
          <>
            <ProfileRow icon="person-outline" label="Name" value={user?.name} /><Divider />
            <ProfileRow icon="call-outline" label="Phone" value={user?.phone} /><Divider />
            <ProfileRow icon="mail-outline" label="Email" value={user?.email} />
          </>
        )}

        {isEditing ? <><Text style={styles.label}>Role</Text><Text style={styles.body}>{formatRole(user?.role)}</Text></> : null}

        {message ? <InfoBanner tone="success" message={message} /> : null}
        {error ? <InfoBanner tone="danger" message={error} /> : null}

        {isEditing ? (
          <>
            <AppButton title="Save profile" onPress={handleSave} loading={loading} />
            <AppButton title="Cancel" variant="secondary" onPress={() => setIsEditing(false)} />
          </>
        ) : (
          <AppButton title="Edit Profile" icon="create-outline" variant="secondary" onPress={() => setIsEditing(true)} />
        )}
      </AppCard>

      <AppButton title="Log Out" icon="log-out-outline" variant="danger" onPress={logout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", gap: spacing.xs }, avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" }, avatarText: { fontSize: 30, fontWeight: "700", color: colors.teal }, name: { ...typography.sectionTitle, color: colors.primaryDark }, role: { ...typography.body, color: colors.textSecondary },
  subtitle: {
    color: COLORS.muted,
    lineHeight: 21
  },
  label: {
    color: COLORS.primaryDark,
    fontWeight: "800"
  },
  body: {
    color: COLORS.text,
    fontSize: 16,
    textTransform: "capitalize"
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: spacing.xxs }, rowLabel: { ...typography.caption, color: colors.textSecondary }, rowValue: { ...typography.bodyStrong, color: colors.textPrimary },
  success: {
    color: COLORS.success,
    fontWeight: "700"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});

function ProfileRow({ icon, label, value }) { return <View style={styles.profileRow}><View style={styles.rowIcon}><Ionicons name={icon} size={20} color={colors.teal} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value || "Not available"}</Text></View></View>; }
