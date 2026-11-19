import type { AuthUser, Session } from "./types";

export const DEFAULT_API_BASE = "https://timeline.wangyang.wiki";

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

export async function apiRequest<T>(
  apiBase: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const base = (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-TickNote-Locale": "zh",
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      (typeof data.error === "string" && data.error) ||
      (typeof data.errorKey === "string" && data.errorKey) ||
      `请求失败 (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function login(
  apiBase: string,
  username: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  return apiRequest(apiBase, "/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
}

export function register(
  apiBase: string,
  username: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  return apiRequest(apiBase, "/api/auth/register", {
    method: "POST",
    body: { username, password },
  });
}

export function fetchMe(apiBase: string, token: string): Promise<AuthUser> {
  return apiRequest(apiBase, "/api/me", { token });
}

export function pushSessions(
  apiBase: string,
  token: string,
  sessions: Session[]
): Promise<{ ok: boolean; accepted: number; total: number }> {
  return apiRequest(apiBase, "/api/sync/push", {
    method: "POST",
    token,
    body: { sessions },
  });
}

export function pullSessions(
  apiBase: string,
  token: string,
  since?: string
): Promise<{ sessions: Session[]; serverTime: string }> {
  const q = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiRequest(apiBase, `/api/sync/pull${q}`, { token });
}

export function fetchSummary(
  apiBase: string,
  token: string
): Promise<{
  totalSessions: number;
  totalMinutes: number;
  averageMinutes: number;
  activeDays: number;
}> {
  return apiRequest(apiBase, "/api/stats/summary", { token });
}
