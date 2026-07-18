import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { COLORS, PROVIDER_ROLES } from "../../utils/constants";

const roles = ["driver", ...PROVIDER_ROLES];

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("driver");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");

    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role
      });
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Create Account</Text>
      <AppCard>
        <AppInput label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <AppInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        <AppInput label="Phone" value={phone} onChangeText={setPhone} placeholder="0712345678" keyboardType="phone-pad" />
        <AppInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <AppInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        <Text style={styles.label}>Account role</Text>
        <View style={styles.roleGrid}>
          {roles.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRole(item)}
              style={[styles.roleOption, role === item && styles.selectedRole]}
            >
              <Text style={[styles.roleText, role === item && styles.selectedRoleText]}>
                {item.replaceAll("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title="Register" onPress={handleRegister} loading={loading} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.primaryDark,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 16
  },
  label: {
    color: COLORS.text,
    fontWeight: "700"
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  roleOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 11
  },
  selectedRole: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  roleText: {
    color: COLORS.text,
    textTransform: "capitalize"
  },
  selectedRoleText: {
    color: COLORS.surface,
    fontWeight: "700"
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 20
  }
});
