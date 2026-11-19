import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { loadAuth, saveAuth } from "./src/storage";
import { colors } from "./src/theme";
import type { AuthState } from "./src/types";

export default function App() {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    loadAuth()
      .then((saved) => setAuth(saved))
      .finally(() => setReady(true));
  }, []);

  async function handleAuthed(next: AuthState) {
    setAuth(next);
    await saveAuth(next);
  }

  async function handleLogout() {
    setAuth(null);
    await saveAuth(null);
  }

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {auth ? (
        <HomeScreen auth={auth} onLogout={handleLogout} />
      ) : (
        <LoginScreen onAuthed={handleAuthed} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
