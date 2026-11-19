import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { AuthState, Session } from "./types";
import { DEFAULT_API_BASE } from "./api";

const AUTH_KEY = "ticknote.auth";
const SESSIONS_KEY = "ticknote.sessions";

export async function loadAuth(): Promise<AuthState | null> {
  const raw = await SecureStore.getItemAsync(AUTH_KEY);
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
    await SecureStore.deleteItemAsync(AUTH_KEY);
    return;
  }
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth));
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
