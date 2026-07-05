import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
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
  const [role, setRole] = useState("driver");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    try {
      await register({ name, email, role });
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

        <Text style={styles.label}>Account role</Text>
        {roles.map((item) => (
          <Pressable
            key={item}
            onPress={() => setRole(item)}
            style={[styles.roleRow, role === item && styles.selectedRole]}
          >
            <Text style={[styles.roleText, role === item && styles.selectedRoleText]}>
              {item.replaceAll("_", " ")}
            </Text>
          </Pressable>
        ))}

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
  roleRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12
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
  }
});
