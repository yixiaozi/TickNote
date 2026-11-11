const recordListEl = document.getElementById("recordList");
const hourListEl = document.getElementById("hourList");
const emptyEl = document.getElementById("empty");
const hourEmptyEl = document.getElementById("hourEmpty");
const totalMinutesEl = document.getElementById("totalMinutes");
const totalSessionsEl = document.getElementById("totalSessions");
const dateLabel = document.getElementById("dateLabel");
const prevDayBtn = document.getElementById("prevDayBtn");
const nextDayBtn = document.getElementById("nextDayBtn");
const closeBtn = document.getElementById("closeBtn");
const miniBtn = document.getElementById("miniBtn");
const deviceBtn = document.getElementById("deviceBtn");
const lockBtn = document.getElementById("lockBtn");
const topBtn = document.getElementById("topBtn");
const opacityBtn = document.getElementById("opacityBtn");
const miniEmptyEl = document.getElementById("miniEmpty");
const calendarPop = document.getElementById("calendarPop");
const calDays = document.getElementById("calDays");
const calMonthLabel = document.getElementById("calMonthLabel");
const calPrevMonth = document.getElementById("calPrevMonth");
const calNextMonth = document.getElementById("calNextMonth");

let sessionsCache = [];
let selectedDate = toDateKey(new Date());
/** @type {number | null} */
let selectedHour = null;
let calendarMonth = startOfMonth(new Date());
let calendarOpen = false;
let prefs = {
  alwaysOnTop: false,
  locked: false,
  opacity: 1,
  mini: false,
  showDevice: false,
};

const OPACITY_STEPS = [1, 0.85, 0.7, 0.55];
const MINI_LIMIT = 5;
const GAP_THRESHOLD_MS = 5000;
/** @type {Set<string>} */
let dismissedGaps = new Set();
/** @type {{ dateKey: string, sessionsRef: any, items: any[] } | null} */
let dayTimelineCache = null;

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sessionTime(session) {
  const raw = session.endedAt || session.startedAt;
  const d = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function formatClock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDuration(minutes) {
  const raw = Math.max(0, Number(minutes) || 0);
  const total = Math.round(raw * 10) / 10;
  if (total < 60) {
    return `${total}分`;
  }
  const hours = Math.floor(total / 60);
  const mins = Math.round((total - hours * 60) * 10) / 10;
  if (mins <= 0) return `${hours}小时`;
  return `${hours}小时${mins}分`;
}

function formatDateShort(key) {
  const date = parseDateKey(key);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function availableDates() {
  return [
    ...new Set(sessionsCache.map((s) => toDateKey(sessionTime(s)))),
  ].sort();
}

function sessionsOnDate(dateKey) {
  return sessionsCache.filter((s) => toDateKey(sessionTime(s)) === dateKey);
}

function hoursForDate(dateKey) {
  const hours = new Set();
  for (const session of sessionsOnDate(dateKey)) {
    hours.add(sessionTime(session).getHours());
  }
  return [...hours].sort((a, b) => a - b);
}

function sessionStart(session) {
  const raw = session.startedAt || session.endedAt;
  const d = raw ? new Date(raw) : new Date(0);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function sessionEnd(session) {
  return sessionTime(session);
}

function gapId(startIso, endIso) {
  return `gap:${startIso}|${endIso}`;
}

function splitRangeByHour(start, end) {
  const parts = [];
  let cursor = new Date(start.getTime());
  const endMs = end.getTime();
  while (cursor.getTime() < endMs) {
    const nextHour = new Date(cursor);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const sliceEndMs = Math.min(nextHour.getTime(), endMs);
    if (sliceEndMs - cursor.getTime() > GAP_THRESHOLD_MS) {
      parts.push({
        start: new Date(cursor.getTime()),
        end: new Date(sliceEndMs),
      });
    }
    cursor = new Date(sliceEndMs);
  }
  return parts;
}

function buildGapItems(gapStart, gapEnd) {
  return splitRangeByHour(gapStart, gapEnd)
    .map(({ start, end }) => {
      const startedAt = start.toISOString();
      const endedAt = end.toISOString();
      const id = gapId(startedAt, endedAt);
      if (dismissedGaps.has(id)) return null;
      const minutes = Math.round(((end - start) / 60_000) * 10) / 10;
      return {
        id,
        isGap: true,
        note: "空白时间（可填写或删除）",
        rounds: 0,
        minutes: Math.min(60, minutes),
        startedAt,
        endedAt,
        device: "",
      };
    })
    .filter(Boolean);
}

function insertGaps(sessions) {
  const sorted = [...sessions].sort(
    (a, b) => sessionStart(a).getTime() - sessionStart(b).getTime()
  );
  const withGaps = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const gapStart = sessionEnd(prev);
      const gapEnd = sessionStart(current);
      if (gapEnd.getTime() - gapStart.getTime() > GAP_THRESHOLD_MS) {
        withGaps.push(...buildGapItems(gapStart, gapEnd));
      }
    }
    withGaps.push(current);
  }
  return withGaps.sort(
    (a, b) => sessionEnd(b).getTime() - sessionEnd(a).getTime()
  );
}

function getDayTimeline(dateKey) {
  if (
    dayTimelineCache &&
    dayTimelineCache.dateKey === dateKey &&
    dayTimelineCache.sessionsRef === sessionsCache
  ) {
    return dayTimelineCache.items;
  }
  const items = insertGaps(sessionsOnDate(dateKey));
  dayTimelineCache = {
    dateKey,
    sessionsRef: sessionsCache,
    items,
  };
  return items;
}

function recordsForSelection() {
  if (selectedHour === null) return [];
  return getDayTimeline(selectedDate).filter((item) => {
    const startHour = sessionStart(item).getHours();
    const endHour = sessionEnd(item).getHours();
    return startHour === selectedHour || endHour === selectedHour;
  });
}

function dayProgressRatio(dateKey) {
  const todayKey = toDateKey(new Date());
  if (dateKey !== todayKey) return null;
  const now = new Date();
  return Math.min(1, Math.max(0, (now.getHours() * 60 + now.getMinutes()) / (24 * 60)));
}

function hourProgressRatio(dateKey, hour) {
  const todayKey = toDateKey(new Date());
  if (dateKey !== todayKey) return null;
  const now = new Date();
  const currentHour = now.getHours();
  if (hour < currentHour) return 1;
  if (hour > currentHour) return 0;
  return Math.min(1, Math.max(0, (now.getMinutes() * 60 + now.getSeconds()) / 3600));
}

function updateSummary(items) {
  const realItems = items.filter((s) => !s.isGap);
  const totalMinutes = realItems.reduce(
    (sum, s) => sum + (Number(s.minutes) || 0),
    0
  );
  totalMinutesEl.textContent = formatDuration(totalMinutes);
  totalSessionsEl.textContent = String(realItems.length);
}

function neighborDate(current, direction) {
  const dates = availableDates();
  if (!dates.length) return null;
  const index = dates.indexOf(current);
  if (index < 0) {
    return direction < 0 ? dates[dates.length - 1] : dates[0];
  }
  const next = index + direction;
  if (next < 0 || next >= dates.length) return null;
  return dates[next];
}

function updateNavButtons() {
  prevDayBtn.disabled = !neighborDate(selectedDate, -1);
  nextDayBtn.disabled = !neighborDate(selectedDate, 1);
}

function renderDate() {
  dateLabel.textContent = formatDateShort(selectedDate);
  updateNavButtons();
}

function renderHours() {
  const hours = hoursForDate(selectedDate);
  if (!hours.length) {
    selectedHour = null;
    hourListEl.innerHTML = "";
    return;
  }

  if (selectedHour === null || !hours.includes(selectedHour)) {
    selectedHour = hours[hours.length - 1];
  }

  hourListEl.innerHTML = hours
    .map((hour) => {
      const progress = hourProgressRatio(selectedDate, hour);
      const progressStyle =
        progress === null ? "" : ` style="--progress:${progress.toFixed(4)}"`;
      return `
      <button
        class="hour-chip${hour === selectedHour ? " active" : ""}"
        data-hour="${hour}"
        type="button"${progressStyle}
      ><span>${hour}</span></button>`;
    })
    .join("");
}

function latestSessions(limit) {
  return [...sessionsCache]
    .sort((a, b) => sessionTime(b).getTime() - sessionTime(a).getTime())
    .slice(0, limit);
}

function renderRecordItems(items) {
  recordListEl.innerHTML = items
    .map((session) => {
      const time = sessionTime(session);
      const start = session.startedAt
        ? formatClock(new Date(session.startedAt))
        : "—";
      const end = formatClock(time);
      const minutes = Number(session.minutes) || 0;
      const device = String(session.device || "").trim();
      const devicePart =
        prefs.showDevice && device
          ? `<div class="record-device" title="${escapeHtml(device)}">${escapeHtml(device)}</div>`
          : "";
      const isGap = Boolean(session.isGap);
      const editable = !prefs.mini;
      const noteText = isGap
        ? session.note || "空白时间（可填写或删除）"
        : session.note || "未命名";
      const actions = isGap
        ? `<div class="record-actions">
            <button class="gap-icon-btn save" type="button" data-fill-gap="${escapeHtml(session.id)}" title="保存为记录" aria-label="保存为记录">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8-8 1.4 1.4-9.4 9.4z"/></svg>
            </button>
            <button class="gap-icon-btn danger" type="button" data-dismiss-gap="${escapeHtml(session.id)}" title="删除空白" aria-label="删除空白">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1 2h4v2H4V6h4l1-2zm1 6h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8zm-1 12h12l1-12H5l1 12z"/></svg>
            </button>
          </div>`
        : "";
      return `
        <article class="record${isGap ? " gap" : ""}" data-id="${escapeHtml(session.id)}" data-gap="${isGap ? "1" : "0"}">
          <div class="record-time">
            <div class="record-range">${start}→${end}</div>
            ${devicePart}
          </div>
          <div class="record-stats">${formatDuration(Math.min(60, minutes))}</div>
          <div class="record-main">
            <div
              class="record-note"
              contenteditable="${editable ? "true" : "false"}"
              spellcheck="false"
              data-id="${escapeHtml(session.id)}"
              data-gap="${isGap ? "1" : "0"}"
              data-started="${escapeHtml(session.startedAt || "")}"
              data-ended="${escapeHtml(session.endedAt || "")}"
              data-minutes="${minutes}"
            >${escapeHtml(noteText)}</div>
            ${actions}
          </div>
        </article>`;
    })
    .join("");
}

function renderRecords() {
  if (prefs.mini) {
    const items = latestSessions(MINI_LIMIT);
    emptyEl.classList.add("hidden");
    hourEmptyEl.classList.add("hidden");
    miniEmptyEl.classList.toggle("hidden", items.length > 0);
    updateSummary(items);
    renderRecordItems(items);
    return;
  }

  miniEmptyEl.classList.add("hidden");
  const dayItems = sessionsOnDate(selectedDate);
  const items = recordsForSelection();

  emptyEl.classList.toggle("hidden", dayItems.length > 0);
  hourEmptyEl.classList.toggle(
    "hidden",
    !(dayItems.length > 0 && items.length === 0)
  );

  updateSummary(selectedHour === null ? dayItems : items);
  renderRecordItems(items);
}

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  calMonthLabel.textContent = `${year}年${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const enabled = new Set(availableDates());

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(`<button class="cal-day muted" type="button" disabled></button>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const hasData = enabled.has(key);
    const selected = key === selectedDate;
    const progress = dayProgressRatio(key);
    const progressStyle =
      progress === null ? "" : ` style="--progress:${progress.toFixed(4)}"`;
    const todayClass = progress === null ? "" : " today";
    cells.push(`
      <button
        class="cal-day${hasData ? " enabled" : ""}${selected ? " selected" : ""}${todayClass}"
        type="button"
        data-date="${key}"
        ${hasData ? "" : "disabled"}${progressStyle}
      ><span>${day}</span></button>`);
  }

  calDays.innerHTML = cells.join("");
}

function setCalendarOpen(open) {
  calendarOpen = open;
  calendarPop.classList.toggle("hidden", !open);
  if (open) {
    calendarMonth = startOfMonth(parseDateKey(selectedDate));
    renderCalendar();
  }
}

function render() {
  renderDate();
  renderHours();
  renderRecords();
  if (calendarOpen) renderCalendar();
}

function setSessions(sessions) {
  sessionsCache = Array.isArray(sessions) ? sessions : [];
  dayTimelineCache = null;

  const dates = availableDates();
  if (dates.length && !dates.includes(selectedDate)) {
    selectedDate = dates[dates.length - 1];
  }

  const active = document.activeElement;
  const editingNote =
    active instanceof HTMLElement && active.classList.contains("record-note")
      ? active
      : null;
  const editingId = editingNote?.dataset.id || "";
  const editingHtml = editingNote ? editingNote.innerHTML : "";
  const listTop = recordListEl?.scrollTop || 0;

  render();

  if (recordListEl) recordListEl.scrollTop = listTop;
  if (editingId) {
    const restored = recordListEl?.querySelector(
      `.record-note[data-id="${editingId.replace(/"/g, "")}"]`
    );
    if (restored instanceof HTMLElement) {
      restored.innerHTML = editingHtml;
      restored.focus();
    }
  }
}

async function saveNote(sessionId, note) {
  const cleaned = note.trim() || "未命名";
  const sessions = await window.statsApi.update({
    id: sessionId,
    note: cleaned,
  });
  sessionsCache = Array.isArray(sessions) ? sessions : sessionsCache;
  const current = sessionsCache.find((s) => s.id === sessionId);
  if (current) current.note = cleaned;
}

async function fillGapFromNote(noteEl, { force = false } = {}) {
  let note = (noteEl.textContent || "").trim();
  if (!note || note === "空白时间（可填写或删除）") {
    if (!force) return;
    note = "空白时间";
  }
  const startedAt = noteEl.dataset.started;
  const endedAt = noteEl.dataset.ended;
  const minutes = Number(noteEl.dataset.minutes) || 0;
  const gapKey = noteEl.dataset.id;
  const sessions = await window.statsApi.add({
    note,
    rounds: Math.max(1, Math.round(minutes) || 1),
    minutes,
    startedAt,
    endedAt,
  });
  if (gapKey) {
    await window.statsApi.dismissGap(gapKey);
    dismissedGaps.add(gapKey);
  }
  setSessions(sessions);
}

hourListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const chip =
    target.closest && target.closest("[data-hour]")
      ? target.closest("[data-hour]")
      : target;
  if (!(chip instanceof HTMLElement) || !chip.dataset.hour) return;
  const nextHour = Number(chip.dataset.hour);
  if (nextHour === selectedHour) return;
  selectedHour = nextHour;
  // Only refresh chips + records; avoid rebuilding calendar timeline.
  renderHours();
  renderRecords();
});

recordListEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.dismissGap) {
    const id = target.dataset.dismissGap;
    await window.statsApi.dismissGap(id);
    dismissedGaps.add(id);
    dayTimelineCache = null;
    renderRecords();
    return;
  }

  if (target.dataset.fillGap) {
    const article = target.closest(".record");
    const noteEl = article?.querySelector(".record-note");
    if (noteEl instanceof HTMLElement) {
      await fillGapFromNote(noteEl, { force: true });
    }
  }
});

recordListEl.addEventListener("focusout", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("record-note")) return;

  const sessionId = target.dataset.id;
  if (!sessionId) return;
  if (target.dataset.gap === "1") {
    await fillGapFromNote(target);
    return;
  }
  await saveNote(sessionId, target.textContent || "");
});

recordListEl.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("record-note")) return;
  if (event.key !== "Enter") return;

  // Ctrl/Cmd+Enter or Shift+Enter → newline (same as main window)
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    event.preventDefault();
    document.execCommand("insertLineBreak");
    return;
  }

  event.preventDefault();
  target.blur();
});

dateLabel.addEventListener("click", (event) => {
  event.stopPropagation();
  setCalendarOpen(!calendarOpen);
});

calPrevMonth.addEventListener("click", (event) => {
  event.stopPropagation();
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

calNextMonth.addEventListener("click", (event) => {
  event.stopPropagation();
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

calDays.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.dataset.date || target.disabled) return;
  selectedDate = target.dataset.date;
  selectedHour = null;
  setCalendarOpen(false);
  render();
});

prevDayBtn.addEventListener("click", () => {
  const prev = neighborDate(selectedDate, -1);
  if (!prev) return;
  selectedDate = prev;
  selectedHour = null;
  render();
});

nextDayBtn.addEventListener("click", () => {
  const next = neighborDate(selectedDate, 1);
  if (!next) return;
  selectedDate = next;
  selectedHour = null;
  render();
});

function renderPrefs() {
  miniBtn.classList.toggle("active", Boolean(prefs.mini));
  deviceBtn.classList.toggle("active", Boolean(prefs.showDevice));
  deviceBtn.title = prefs.showDevice ? "隐藏机器名" : "显示机器名";
  lockBtn.classList.toggle("active", Boolean(prefs.locked));
  lockBtn.title = prefs.locked ? "取消固定位置" : "固定位置";
  topBtn.classList.toggle("active", Boolean(prefs.alwaysOnTop));
  topBtn.title = prefs.alwaysOnTop ? "取消置顶" : "窗口置顶";
  opacityBtn.classList.toggle("active", prefs.opacity < 0.999);
  opacityBtn.textContent = `${Math.round(prefs.opacity * 100)}`;
  opacityBtn.title = `透明度 ${Math.round(prefs.opacity * 100)}%`;
  document.body.classList.toggle("locked", Boolean(prefs.locked));
  document.body.classList.toggle("mini", Boolean(prefs.mini));
  if (prefs.mini) setCalendarOpen(false);
  render();
}

async function patchPrefs(patch) {
  prefs = await window.statsApi.setPrefs(patch);
  renderPrefs();
}

miniBtn.addEventListener("click", () => {
  patchPrefs({ mini: !prefs.mini });
});

deviceBtn.addEventListener("click", () => {
  patchPrefs({ showDevice: !prefs.showDevice });
});

lockBtn.addEventListener("click", () => {
  patchPrefs({ locked: !prefs.locked });
});

topBtn.addEventListener("click", () => {
  patchPrefs({ alwaysOnTop: !prefs.alwaysOnTop });
});

opacityBtn.addEventListener("click", () => {
  const current = Math.round(prefs.opacity * 100) / 100;
  const index = OPACITY_STEPS.findIndex((v) => Math.abs(v - current) < 0.01);
  const next = OPACITY_STEPS[(index + 1) % OPACITY_STEPS.length];
  patchPrefs({ opacity: next });
});

closeBtn.addEventListener("click", () => {
  window.statsApi?.close?.();
});

if (window.statsApi?.onPrefs) {
  window.statsApi.onPrefs((next) => {
    prefs = next;
    renderPrefs();
  });
}

window.statsApi.getPrefs().then((next) => {
  prefs = { mini: false, showDevice: false, locked: false, ...next };
  renderPrefs();
});

window.statsApi.getDismissedGaps?.().then((ids) => {
  dismissedGaps = new Set(Array.isArray(ids) ? ids : []);
  render();
});

document.addEventListener("click", (event) => {
  if (!calendarOpen) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (calendarPop.contains(target) || dateLabel.contains(target)) return;
  setCalendarOpen(false);
});

// Refresh today progress while stats stay open.
setInterval(() => {
  if (document.hidden) return;
  if (prefs.mini) return;
  renderHours();
  if (calendarOpen) renderCalendar();
}, 30_000);

if (window.statsApi?.onData) {
  window.statsApi.onData((sessions) => setSessions(sessions));
}

window.statsApi.list().then(setSessions);
