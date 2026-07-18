import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../utils/constants";

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
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Backend account details.</Text>
      </View>

      <AppCard>
        {isEditing ? (
          <>
            <AppInput label="Name" value={name} onChangeText={setName} />
            <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </>
        ) : (
          <>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.body}>{user?.name || "Not available"}</Text>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.body}>{user?.phone || "Not available"}</Text>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.body}>{user?.email || "Not available"}</Text>
          </>
        )}

        <Text style={styles.label}>Role</Text>
        <Text style={styles.body}>{formatRole(user?.role)}</Text>

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isEditing ? (
          <>
            <AppButton title="Save profile" onPress={handleSave} loading={loading} />
            <AppButton title="Cancel" variant="secondary" onPress={() => setIsEditing(false)} />
          </>
        ) : (
          <AppButton title="Edit profile" variant="secondary" onPress={() => setIsEditing(true)} />
        )}
      </AppCard>

      <AppButton title="Logout" variant="danger" onPress={logout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6
  },
  title: {
    color: COLORS.primaryDark,
    fontSize: 26,
    fontWeight: "900"
  },
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
