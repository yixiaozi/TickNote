const TOKEN_KEY = "ticknote_timeline_token";

function t(key, vars) {
  if (window.TickNoteI18n && typeof window.TickNoteI18n.t === "function") {
    return window.TickNoteI18n.t(key, vars);
  }
  return key;
}

function getLocale() {
  if (window.TickNoteI18n && typeof window.TickNoteI18n.getLocale === "function") {
    return window.TickNoteI18n.getLocale();
  }
  return "en";
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const locale = getLocale();
  const headers = {
    "Content-Type": "application/json",
    "X-TickNote-Locale": locale,
    "Accept-Language": locale === "zh" ? "zh-CN,zh;q=0.9,en;q=0.8" : "en",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const dictKey = data.errorKey ? `api.${data.errorKey}` : "";
    const hasKey =
      dictKey &&
      (window.TickNoteI18n?.dictionaries?.en?.[dictKey] ||
        window.TickNoteI18n?.dictionaries?.zh?.[dictKey]);
    throw new Error(
      hasKey
        ? t(dictKey)
        : data.error || t("api.request_failed", { status: res.status })
    );
  }
  return data;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDuration(minutes) {
  const total = Math.round((Number(minutes) || 0) * 10) / 10;
  if (total < 60) return t("duration.minutes", { n: total });
  const h = Math.floor(total / 60);
  const m = Math.round((total - h * 60) * 10) / 10;
  return m > 0
    ? t("duration.hours_minutes", { h, m })
    : t("duration.hours", { h });
}

function formatClock(iso) {
  if (!iso) return t("common.dash");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t("common.dash");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

function localizeNote(note) {
  const value = String(note || "").trim();
  if (!value || value === "未命名" || value === "Untitled") {
    return t("common.unnamed");
  }
  return value;
}

function localizeDevice(device) {
  const value = String(device || "").trim();
  if (!value || value === "未知设备" || value === "Unknown device") {
    return t("common.unknown_device");
  }
  return value;
}

function renderBars(container, items, nameKey, valueKey) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="muted">${escapeHtml(t("common.no_data"))}</div>`;
    return;
  }
  const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 0.1);
  container.innerHTML = items
    .map((item) => {
      const value = Number(item[valueKey]) || 0;
      const pct = Math.max(2, Math.round((value / max) * 100));
      const rawName = String(item[nameKey]);
      const name =
        nameKey === "device" ? localizeDevice(rawName) : rawName;
      return `<div class="bar-row">
        <div class="name">${escapeHtml(name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="num">${formatDuration(value)}</div>
      </div>`;
    })
    .join("");
}

function renderSummaryCards(container, summary) {
  if (!container) return;
  const cards = [
    [t("summary.total_time"), formatDuration(summary.totalMinutes)],
    [t("summary.sessions"), String(summary.totalSessions)],
    [t("summary.active_days"), String(summary.activeDays)],
    [t("summary.avg_session"), formatDuration(summary.averageMinutes)],
  ];
  container.innerHTML = cards
    .map(
      ([label, value]) =>
        `<article class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`
    )
    .join("");
}

function renderSessions(container, sessions, countEl) {
  if (!container) return;
  if (countEl) countEl.textContent = t("common.sessions_count", { n: sessions.length });
  if (!sessions.length) {
    container.innerHTML = `<div class="muted">${escapeHtml(t("common.no_sessions"))}</div>`;
    return;
  }
  container.innerHTML = sessions
    .slice(0, 80)
    .map((s) => {
      return `<article class="session">
        <div class="meta">${formatClock(s.endedAt || s.startedAt)}</div>
        <div class="mins">${formatDuration(s.minutes)}</div>
        <div class="note">${escapeHtml(localizeNote(s.note))}${
          s.device
            ? `<div class="meta">${escapeHtml(localizeDevice(s.device))}</div>`
            : ""
        }</div>
      </article>`;
    })
    .join("");
}

async function requireAuthOrRedirect() {
  if (!getToken()) {
    location.href = "/login";
    return null;
  }
  try {
    return await api("/api/me");
  } catch {
    setToken("");
    location.href = "/login";
    return null;
  }
}

function wireLogout(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    setToken("");
    location.href = "/";
  });
}
