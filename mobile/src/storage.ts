import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { AuthState, Session } from "./types";
import { DEFAULT_API_BASE } from "./api";

const AUTH_KEY = "ticknote.auth";
const SESSIONS_KEY = "ticknote.sessions";

async function readSecure(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function writeSecure(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value === null) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, value);
    }
    return;
  }
  const SecureStore = await import("expo-secure-store");
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function loadAuth(): Promise<AuthState | null> {
  const raw = await readSecure(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed?.token || !parsed?.user) return null;
    return {
      ...parsed,
      apiBase: parsed.apiBase || DEFAULT_API_BASE,
    };
  } catch {
    return null;
  }
}

export async function saveAuth(auth: AuthState | null): Promise<void> {
  if (!auth) {
    await writeSecure(AUTH_KEY, null);
    return;
  }
  await writeSecure(AUTH_KEY, JSON.stringify(auth));
}

export async function loadLocalSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Session[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveLocalSessions(sessions: Session[]): Promise<void> {
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}
