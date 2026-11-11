const TOKEN_KEY = "ticknote_timeline_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
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
  if (total < 60) return `${total}分`;
  const h = Math.floor(total / 60);
  const m = Math.round((total - h * 60) * 10) / 10;
  return m > 0 ? `${h}小时${m}分` : `${h}小时`;
}

function formatClock(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

function renderBars(container, items, nameKey, valueKey) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="muted">暂无数据</div>`;
    return;
  }
  const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 0.1);
  container.innerHTML = items
    .map((item) => {
      const value = Number(item[valueKey]) || 0;
      const pct = Math.max(2, Math.round((value / max) * 100));
      return `<div class="bar-row">
        <div class="name">${escapeHtml(String(item[nameKey]))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="num">${formatDuration(value)}</div>
      </div>`;
    })
    .join("");
}

function renderSummaryCards(container, summary) {
  if (!container) return;
  const cards = [
    ["总时长", formatDuration(summary.totalMinutes)],
    ["记录数", String(summary.totalSessions)],
    ["活跃天数", String(summary.activeDays)],
    ["平均每条", formatDuration(summary.averageMinutes)],
  ];
  container.innerHTML = cards
    .map(
      ([label, value]) =>
        `<article class="card"><div class="label">${label}</div><div class="value">${value}</div></article>`
    )
    .join("");
}

function renderSessions(container, sessions, countEl) {
  if (!container) return;
  if (countEl) countEl.textContent = `${sessions.length} 条`;
  if (!sessions.length) {
    container.innerHTML = `<div class="muted">暂无记录</div>`;
    return;
  }
  container.innerHTML = sessions
    .slice(0, 80)
    .map((s) => {
      return `<article class="session">
        <div class="meta">${formatClock(s.endedAt || s.startedAt)}</div>
        <div class="mins">${formatDuration(s.minutes)}</div>
        <div class="note">${escapeHtml(s.note || "未命名")}${
          s.device
            ? `<div class="meta">${escapeHtml(s.device)}</div>`
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
