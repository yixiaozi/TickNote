import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchSummary, pullSessions, pushSessions } from "../api";
import {
  createFinishedSession,
  deviceLabel,
  findRecentForeignSessions,
  formatDuration,
  mergeSessions,
  nowIso,
} from "../session";
import { loadLocalSessions, saveLocalSessions } from "../storage";
import { colors } from "../theme";
import type { AuthState, Session } from "../types";

const ROUND_SECONDS = 60;
const MY_DEVICE = deviceLabel();
const SYNC_POLL_MS = 30_000;

type Props = {
  auth: AuthState;
  onLogout: () => void;
};

export function HomeScreen({ auth, onLogout }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [note, setNote] = useState("");
  const [remaining, setRemaining] = useState(ROUND_SECONDS);
  const [running, setRunning] = useState(true);
  const [roundStartedAt, setRoundStartedAt] = useState(nowIso());
  const [syncMsg, setSyncMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [summaryText, setSummaryText] = useState("—");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionsRef = useRef<Session[]>([]);
  const syncingRef = useRef(false);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  function restartTimerFromRemote(devices: string[]) {
    const label = devices.filter(Boolean).join(" / ") || "其他设备";
    setNote("");
    setRoundStartedAt(nowIso());
    setRemaining(ROUND_SECONDS);
    setRunning(true);
    setSyncMsg(`已收到 ${label} 的记录，本机计时已重新开始`);
  }

  async function refreshSummary() {
    const summary = await fetchSummary(auth.apiBase, auth.token);
    setSummaryText(
      `${formatDuration(summary.totalMinutes)} · ${summary.totalSessions} 条`
    );
  }

  async function persist(next: Session[]) {
    sessionsRef.current = next;
    setSessions(next);
    await saveLocalSessions(next);
  }

  async function syncOnce({
    pushLocal = true,
    quiet = false,
  }: { pushLocal?: boolean; quiet?: boolean } = {}) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (!quiet) setBusy(true);
    try {
      const local = sessionsRef.current;
      if (pushLocal && local.length) {
        await pushSessions(auth.apiBase, auth.token, local);
      }
      const remote = await pullSessions(auth.apiBase, auth.token);
      const incoming = remote.sessions || [];
      const foreignRecent = findRecentForeignSessions(local, incoming, {
        myDevice: MY_DEVICE,
      });
      const merged = mergeSessions(local, incoming);
      await persist(merged);
      await refreshSummary();
      if (foreignRecent.length > 0) {
        restartTimerFromRemote(
          foreignRecent.map((s) => String(s.device || "").trim())
        );
      } else if (!quiet) {
        setSyncMsg(`同步完成（本地 ${merged.length} 条）`);
      }
    } catch (err) {
      if (!quiet) {
        setSyncMsg(err instanceof Error ? err.message : "同步失败");
      }
    } finally {
      syncingRef.current = false;
      if (!quiet) setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalSessions();
      if (cancelled) return;
      sessionsRef.current = local;
      setSessions(local);
      try {
        await syncOnce({ pushLocal: true, quiet: true });
      } catch {
        /* syncOnce handles message */
      }
    })();

    const poll = setInterval(() => {
      syncOnce({ pushLocal: true, quiet: true }).catch(() => {});
    }, SYNC_POLL_MS);

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncOnce({ pushLocal: true, quiet: true }).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      clearInterval(poll);
      appSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.apiBase, auth.token]);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) return ROUND_SECONDS;
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  const recent = useMemo(() => sessions.slice(0, 40), [sessions]);

  async function finishRound() {
    const endedAt = nowIso();
    const session = createFinishedSession({
      note,
      startedAt: roundStartedAt,
      endedAt,
      rounds: 1,
    });
    const next = mergeSessions([session, ...sessionsRef.current], []);
    await persist(next);
    setNote("");
    setRoundStartedAt(endedAt);
    setRemaining(ROUND_SECONDS);
    setSyncMsg("已保存，正在同步…");
    await syncOnce({ pushLocal: true, quiet: false });
  }

  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <View style={styles.wrap}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>TickNote</Text>
          <Text style={styles.user}>
            {auth.user.displayName || auth.user.username}
          </Text>
        </View>
        <Pressable onPress={onLogout}>
          <Text style={styles.link}>退出</Text>
        </Pressable>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.kicker}>一分钟循环</Text>
        <Text style={styles.clock}>
          {mm}:{ss}
        </Text>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder="这一分钟在做什么…"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={finishRound}
        />
        <View style={styles.row}>
          <Pressable style={styles.primaryBtn} onPress={finishRound}>
            <Text style={styles.primaryText}>记一条并重开</Text>
          </Pressable>
          <Pressable
            style={styles.ghostBtn}
            onPress={() => setRunning((v) => !v)}
          >
            <Text style={styles.ghostText}>{running ? "暂停" : "继续"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{summaryText}</Text>
        <Pressable
          style={[styles.syncBtn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => syncOnce({ pushLocal: true, quiet: false })}
        >
          {busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.syncText}>同步</Text>
          )}
        </Pressable>
      </View>
      {syncMsg ? <Text style={styles.hint}>{syncMsg}</Text> : null}

      <Text style={styles.listTitle}>最近记录</Text>
      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemMins}>{formatDuration(item.minutes)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemNote}>{item.note}</Text>
              <Text style={styles.itemMeta}>
                {(item.endedAt || item.startedAt || "")
                  .replace("T", " ")
                  .slice(0, 19)}
                {item.device ? ` · ${item.device}` : ""}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.hint}>还没有记录，先记一条吧。</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 56,
    paddingHorizontal: 18,
  },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  user: { color: colors.muted, marginTop: 2, fontSize: 13 },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  timerCard: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 14,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  clock: {
    color: colors.text,
    fontSize: 56,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginVertical: 8,
  },
  note: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryText: { color: "#06201c", fontWeight: "700", fontSize: 15 },
  ghostBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: "center",
  },
  ghostText: { color: colors.text, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  meta: { color: colors.muted, fontSize: 13 },
  syncBtn: {
    borderWidth: 1,
    borderColor: "rgba(61,214,198,0.35)",
    backgroundColor: "rgba(61,214,198,0.12)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 64,
    alignItems: "center",
  },
  syncText: { color: colors.accent, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  listTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemMins: {
    color: colors.accent,
    fontWeight: "700",
    width: 72,
    fontVariant: ["tabular-nums"],
  },
  itemNote: { color: colors.text, fontWeight: "600", fontSize: 15 },
  itemMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
