import type { Session } from "./types";

export function newId(): string {
  return `ios-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Number(totalMinutes) || 0);
  if (minutes < 60) {
    const rounded = Math.round(minutes * 10) / 10;
    return `${rounded} 分`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = Math.round((minutes % 60) * 10) / 10;
  if (hours < 24) {
    return rem > 0 ? `${hours} 小时 ${rem} 分` : `${hours} 小时`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} 天 ${remHours} 小时` : `${days} 天`;
}

export function mergeSessions(
  localSessions: Session[],
  remoteSessions: Session[]
): Session[] {
  const map = new Map<string, Session>();
  for (const session of localSessions || []) {
    if (!session?.id) continue;
    map.set(session.id, {
      ...session,
      updatedAt:
        session.updatedAt || session.endedAt || session.startedAt || null,
    });
  }
  for (const remote of remoteSessions || []) {
    if (!remote?.id) continue;
    if (remote.deleted) {
      map.delete(remote.id);
      continue;
    }
    const local = map.get(remote.id);
    const remoteUpdated = remote.updatedAt || remote.endedAt || "";
    const localUpdated =
      (local && (local.updatedAt || local.endedAt || local.startedAt)) || "";
    if (!local || String(remoteUpdated) > String(localUpdated)) {
      map.set(remote.id, {
        id: remote.id,
        note: remote.note,
        rounds: remote.rounds,
        minutes: remote.minutes,
        device: remote.device || "",
        startedAt: remote.startedAt || null,
        endedAt: remote.endedAt || null,
        updatedAt: remote.updatedAt || remote.endedAt || null,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.endedAt || a.startedAt || 0).getTime();
    const tb = new Date(b.endedAt || b.startedAt || 0).getTime();
    return tb - ta;
  });
}

export function createFinishedSession(input: {
  note: string;
  startedAt: string;
  endedAt: string;
  rounds?: number;
}): Session {
  const started = new Date(input.startedAt).getTime();
  const ended = new Date(input.endedAt).getTime();
  const minutes = Math.max(
    0.1,
    Math.round(((ended - started) / 60000) * 10) / 10
  );
  return {
    id: newId(),
    note: input.note.trim() || "未命名",
    rounds: Math.max(1, input.rounds || 1),
    minutes,
    device: "TickNote iOS",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    updatedAt: input.endedAt,
  };
}
