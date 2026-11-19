import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DEFAULT_API_BASE, login, register } from "../api";
import { colors } from "../theme";
import type { AuthState } from "../types";

type Props = {
  onAuthed: (auth: AuthState) => void;
};

export function LoginScreen({ onAuthed }: Props) {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const fn = mode === "login" ? login : register;
      const data = await fn(apiBase.trim() || DEFAULT_API_BASE, username.trim(), password);
      onAuthed({
        token: data.token,
        user: data.user,
        apiBase: apiBase.trim() || DEFAULT_API_BASE,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.brand}>TickNote</Text>
      <Text style={styles.sub}>手机上记一分钟，同步到 Timeline</Text>

      <View style={styles.card}>
        <Text style={styles.label}>服务器</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={apiBase}
          onChangeText={setApiBase}
          placeholder={DEFAULT_API_BASE}
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>用户名</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          placeholder="admin"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>密码</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="至少 6 位"
          placeholderTextColor={colors.muted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          disabled={busy || !username.trim() || password.length < 6}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color="#06201c" />
          ) : (
            <Text style={styles.primaryText}>
              {mode === "login" ? "登录" : "注册"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() =>
            setMode((m) => (m === "login" ? "register" : "login"))
          }
        >
          <Text style={styles.switch}>
            {mode === "login" ? "没有账号？注册" : "已有账号？去登录"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  sub: {
    color: colors.muted,
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  primaryText: {
    color: "#06201c",
    fontWeight: "700",
    fontSize: 16,
  },
  switch: {
    color: colors.accent,
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    marginTop: 4,
    fontSize: 13,
  },
});
