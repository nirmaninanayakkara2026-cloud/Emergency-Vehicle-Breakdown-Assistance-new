import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import { useAuth } from "../../context/AuthContext";
import { COLORS, PROVIDER_ROLES } from "../../utils/constants";

const roles = ["driver", ...PROVIDER_ROLES];

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("driver@example.com");
  const [password, setPassword] = useState("password");
  const [role, setRole] = useState("driver");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await login({ email, password, role });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Breakdown Assist</Text>
        <Text style={styles.subtitle}>Emergency vehicle assistance demo app</Text>
      </View>

      <AppCard>
        <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <AppInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.label}>Login as</Text>
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

        <AppButton title="Login" onPress={handleLogin} loading={loading} />
        <AppButton title="Create demo account" variant="secondary" onPress={() => navigation.navigate("Register")} />
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 36,
    marginBottom: 8,
    gap: 8
  },
  title: {
    color: COLORS.primaryDark,
    fontSize: 32,
    fontWeight: "900"
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 16
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surface
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
