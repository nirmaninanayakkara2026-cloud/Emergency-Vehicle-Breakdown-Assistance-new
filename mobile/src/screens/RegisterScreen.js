import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import FormInput from "../components/FormInput";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F5F8F5", card: "#FFFFFF", primary: "#287A5B", text: "#193D31",
  muted: "#687B74", border: "#D8E4DD", danger: "#C73E3E",
};

const roles = [
  { label: "Driver", value: "driver" },
  { label: "Mechanic", value: "mechanic" },
  { label: "Garage", value: "garage" },
  { label: "Spare parts shop", value: "spare_parts_shop" },
];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "driver" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim() });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Create account" subtitle="Choose the role that matches how you will use the app." colors={SCREEN_COLORS} />
      <FormInput label="Name" value={form.name} onChangeText={update("name")} colors={SCREEN_COLORS} />
      <FormInput label="Email" value={form.email} onChangeText={update("email")} autoCapitalize="none" keyboardType="email-address" colors={SCREEN_COLORS} />
      <FormInput label="Phone" value={form.phone} onChangeText={update("phone")} keyboardType="phone-pad" colors={SCREEN_COLORS} />
      <FormInput label="Password" value={form.password} onChangeText={update("password")} secureTextEntry colors={SCREEN_COLORS} />
      <View style={styles.roleGroup}>
        <Text style={[styles.roleLabel, { color: SCREEN_COLORS.text }]}>Role</Text>
        <View style={styles.roleGrid}>
          {roles.map((role) => {
            const selected = form.role === role.value;
            return (
              <Pressable
                key={role.value}
                onPress={() => update("role")(role.value)}
                style={[
                  styles.roleButton,
                  {
                    backgroundColor: selected ? SCREEN_COLORS.primary : SCREEN_COLORS.card,
                    borderColor: selected ? SCREEN_COLORS.primary : SCREEN_COLORS.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { color: selected ? "#FFFFFF" : SCREEN_COLORS.text },
                  ]}
                >
                  {role.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.selectedRole, { color: SCREEN_COLORS.muted }]}>
          Selected role: {roles.find((role) => role.value === form.role)?.label}
        </Text>
      </View>
      <Message colors={SCREEN_COLORS}>{error}</Message>
      <AppButton title="Register" onPress={submit} loading={loading} colors={SCREEN_COLORS} />
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={[styles.link, { color: SCREEN_COLORS.primary }]}>Already registered? Login</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 15, marginTop: 20, textAlign: "center" },
  roleButton: {
    borderRadius: 10,
    borderWidth: 1,
    minWidth: "47%",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleGroup: { marginBottom: 14 },
  roleLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  roleText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  selectedRole: { fontSize: 13, marginTop: 8 },
});
