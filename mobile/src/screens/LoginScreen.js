import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import AppButton from "../components/AppButton";
import FormInput from "../components/FormInput";
import Message from "../components/Message";
import PageTitle from "../components/PageTitle";
import Screen from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errorMessage";

// Change this page's colors here.
const SCREEN_COLORS = {
  background: "#F4F7FB", card: "#FFFFFF", primary: "#176B87", text: "#17324D",
  muted: "#66788A", border: "#D8E1E8", danger: "#C73E3E",
};

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen colors={SCREEN_COLORS}>
      <PageTitle title="Welcome back" subtitle="Sign in to request or provide roadside assistance." colors={SCREEN_COLORS} />
      <FormInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" colors={SCREEN_COLORS} />
      <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry colors={SCREEN_COLORS} />
      <Message colors={SCREEN_COLORS}>{error}</Message>
      <AppButton title="Login" onPress={submit} loading={loading} colors={SCREEN_COLORS} />
      <Pressable onPress={() => navigation.navigate("Register")}>
        <Text style={[styles.link, { color: SCREEN_COLORS.primary }]}>New here? Create an account</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({ link: { fontSize: 15, marginTop: 20, textAlign: "center" } });
