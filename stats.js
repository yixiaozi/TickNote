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
};

const OPACITY_STEPS = [1, 0.85, 0.7, 0.55];
const MINI_LIMIT = 5;

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

function recordsForSelection() {
  if (selectedHour === null) return [];
  return sessionsOnDate(selectedDate)
    .filter((s) => sessionTime(s).getHours() === selectedHour)
    .sort((a, b) => sessionTime(b).getTime() - sessionTime(a).getTime());
}

function updateSummary(items) {
  const totalMinutes = items.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  totalMinutesEl.textContent = String(Math.round(totalMinutes * 10) / 10);
  totalSessionsEl.textContent = String(items.length);
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
    .map(
      (hour) => `
      <button
        class="hour-chip${hour === selectedHour ? " active" : ""}"
        data-hour="${hour}"
        type="button"
      >${hour}</button>`
    )
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
      return `
        <article class="record" data-id="${escapeHtml(session.id)}">
          <div class="record-meta">${start}→${end}</div>
          <div class="record-stats">${minutes}分</div>
          <div
            class="record-note"
            contenteditable="${prefs.mini ? "false" : "true"}"
            spellcheck="false"
            data-id="${escapeHtml(session.id)}"
          >${escapeHtml(session.note || "未命名")}</div>
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
    cells.push(`
      <button
        class="cal-day${hasData ? " enabled" : ""}${selected ? " selected" : ""}"
        type="button"
        data-date="${key}"
        ${hasData ? "" : "disabled"}
      >${day}</button>`);
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

  const dates = availableDates();
  if (dates.length && !dates.includes(selectedDate)) {
    selectedDate = dates[dates.length - 1];
  }

  render();
}

async function saveNote(sessionId, note) {
  const cleaned = note.trim() || "未命名";
  const sessions = await window.statsApi.update({
    id: sessionId,
    note: cleaned,
  });
  sessionsCache = sessions;
}

hourListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.dataset.hour) return;
  selectedHour = Number(target.dataset.hour);
  render();
});

recordListEl.addEventListener("focusout", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("record-note")) return;

  const sessionId = target.dataset.id;
  if (!sessionId) return;
  await saveNote(sessionId, target.textContent || "");
});

recordListEl.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("record-note")) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    target.blur();
  }
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
  lockBtn.classList.toggle("active", Boolean(prefs.locked));
  topBtn.classList.toggle("active", Boolean(prefs.alwaysOnTop || prefs.mini));
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

lockBtn.addEventListener("click", () => {
  if (prefs.mini) return;
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
  prefs = { mini: false, ...next };
  renderPrefs();
});

document.addEventListener("click", (event) => {
  if (!calendarOpen) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (calendarPop.contains(target) || dateLabel.contains(target)) return;
  setCalendarOpen(false);
});

if (window.statsApi?.onData) {
  window.statsApi.onData((sessions) => setSessions(sessions));
}

window.statsApi.list().then(setSessions);
