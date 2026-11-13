const DURATION_MS = 60_000;
const CIRCUMFERENCE = 2 * Math.PI * 42;

const timeEl = document.getElementById("time");
const ringEl = document.getElementById("ringProgress");
const widgetEl = document.getElementById("widget");
const loopCountEl = document.getElementById("loopCount");
const resetBtn = document.getElementById("resetBtn");
const noteInput = document.getElementById("noteInput");
const statsBtn = document.getElementById("statsBtn");
const tickBtn = document.getElementById("tickBtn");

ringEl.style.strokeDasharray = String(CIRCUMFERENCE);

/** @type {AudioContext | null} */
let audioCtx = null;
/** Active countdown elapsed; sleep gaps are not counted. */
let activeElapsedMs = 0;
let lastWallTick = Date.now();
let sessionStartedAt = new Date();
let completedLoops = 0;
let lastDisplaySec = -1;
let lastCompletedLoops = -1;
let zeroHoldUntil = 0;
let tickSoundEnabled = true;
let resetting = false;
let lastDraftSaveAt = 0;
const SLEEP_GAP_MS = 2500;

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function beep(frequency, durationMs, gainValue, type = "sine") {
  ensureAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

function playTick(isEvenSecond) {
  if (!tickSoundEnabled) return;
  if (isEvenSecond) {
    beep(1180, 28, 0.07, "triangle");
  } else {
    beep(880, 32, 0.055, "triangle");
  }
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setPhase(remainingSec) {
  widgetEl.classList.remove("warn", "danger");
  if (remainingSec <= 3) {
    widgetEl.classList.add("danger");
  } else if (remainingSec <= 10) {
    widgetEl.classList.add("warn");
  }
}

function playAlertCue(remainingSec) {
  if (remainingSec === 3) beep(660, 120, 0.18);
  else if (remainingSec === 2) beep(740, 120, 0.2);
  else if (remainingSec === 1) beep(880, 140, 0.24);
  else if (remainingSec === 0) {
    beep(523.25, 90, 0.2);
    setTimeout(() => beep(784, 220, 0.24), 110);
  }
}

function updateTray(timeLabel, loops) {
  if (window.countdownApi?.setTrayLabel) {
    window.countdownApi.setTrayLabel(`${timeLabel} · 第${loops}轮`);
  }
}

function renderLoopCount(loops) {
  loopCountEl.textContent = String(loops);
}

function syncActiveElapsed() {
  const wallNow = Date.now();
  let delta = wallNow - lastWallTick;
  lastWallTick = wallNow;
  // Sleep / long stall: do not add the paused wall time to rounds.
  if (delta < 0 || delta > SLEEP_GAP_MS) {
    delta = 0;
  }
  activeElapsedMs += delta;
  return activeElapsedMs;
}

function currentMinutes() {
  return Math.round((activeElapsedMs / 60_000) * 10) / 10;
}

function buildDraftPayload() {
  const endedAt = new Date();
  // Duration always follows wall-clock start/end (source of truth).
  const minutes = Math.max(
    0,
    Math.round(((endedAt.getTime() - sessionStartedAt.getTime()) / 60_000) * 10) /
      10
  );
  return {
    note: noteInput.value.trim() || "未命名",
    rounds: completedLoops,
    minutes,
    startedAt: sessionStartedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  };
}

function persistDraft(force = false) {
  if (!window.countdownApi?.saveDraft) return;
  const now = Date.now();
  if (!force && now - lastDraftSaveAt < 5000) return;

  const draft = buildDraftPayload();
  if (draft.minutes < 0.2) return;

  lastDraftSaveAt = now;
  window.countdownApi.saveDraft(draft);
}

async function saveCurrentSession() {
  const draft = buildDraftPayload();
  if (draft.minutes < 0.2) {
    await window.countdownApi?.clearDraft?.();
    return;
  }

  if (window.countdownApi?.addSession) {
    await window.countdownApi.addSession(draft);
  }
}

async function resetCountdown() {
  if (resetting) return;
  resetting = true;
  try {
    await saveCurrentSession();
    ensureAudio();
    activeElapsedMs = 0;
    lastWallTick = Date.now();
    sessionStartedAt = new Date();
    completedLoops = 0;
    lastDisplaySec = -1;
    lastCompletedLoops = -1;
    zeroHoldUntil = 0;
    lastDraftSaveAt = 0;
    noteInput.value = "";
    syncNoteInputHeight();
    renderLoopCount(0);
    updateTray("1:00", 0);
    timeEl.textContent = "1:00";
    setPhase(60);
    ringEl.style.strokeDashoffset = "0";
    beep(640, 70, 0.12);
    noteInput.focus();
  } finally {
    resetting = false;
  }
}

function update() {
  const totalElapsed = syncActiveElapsed();
  const cycles = Math.floor(totalElapsed / DURATION_MS);
  const elapsed = totalElapsed - cycles * DURATION_MS;
  const remainingMs = DURATION_MS - elapsed;
  let displaySec = Math.ceil(remainingMs / 1000);
  if (displaySec > 60) displaySec = 60;
  const wallNow = Date.now();

  if (cycles > completedLoops) {
    completedLoops = cycles;
    persistDraft(true);
  }

  if (cycles > 0 && elapsed < 16 && zeroHoldUntil < wallNow) {
    zeroHoldUntil = wallNow + 280;
  }
  if (wallNow < zeroHoldUntil) {
    displaySec = 0;
  } else if (displaySec === 0) {
    displaySec = 60;
  }

  const label = formatTime(displaySec);
  timeEl.textContent = label;
  setPhase(displaySec);

  if (completedLoops !== lastCompletedLoops) {
    lastCompletedLoops = completedLoops;
    renderLoopCount(completedLoops);
  }

  const visualElapsed = displaySec === 0 ? DURATION_MS : elapsed;
  const progress = visualElapsed / DURATION_MS;
  ringEl.style.strokeDashoffset = String(CIRCUMFERENCE * progress);

  if (displaySec !== lastDisplaySec) {
    lastDisplaySec = displaySec;
    updateTray(label, completedLoops);
    persistDraft(false);

    if (displaySec > 3) {
      playTick(displaySec % 2 === 0);
    } else {
      playAlertCue(displaySec);
    }
  }

  requestAnimationFrame(update);
}

resetBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  resetCountdown();
});

resetBtn.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    resetCountdown();
  }
});

statsBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  persistDraft(true);
  window.countdownApi?.openStats?.();
});

const NOTE_INPUT_MIN_HEIGHT = 26;
const NOTE_INPUT_MAX_HEIGHT = 146;

function syncNoteInputHeight() {
  // Collapse first so scrollHeight reflects content, not the previous frame.
  noteInput.style.height = "0px";
  const styles = window.getComputedStyle(noteInput);
  const borderY =
    (parseFloat(styles.borderTopWidth) || 0) +
    (parseFloat(styles.borderBottomWidth) || 0);
  // border-box: scrollHeight excludes borders, so add them back or the last
  // line sits flush against (or under) the bottom edge.
  const next = Math.min(
    NOTE_INPUT_MAX_HEIGHT,
    Math.max(NOTE_INPUT_MIN_HEIGHT, noteInput.scrollHeight + borderY)
  );
  noteInput.style.height = `${next}px`;

  // Widget is height:auto now — measure the full document, not a 100%-stretched
  // card that never grew with the textarea.
  const totalHeight = Math.ceil(
    Math.max(document.body.offsetHeight, widgetEl.offsetHeight + 16)
  );
  window.countdownApi?.resizeHeight?.(totalHeight);
}

function renderTickButton() {
  if (!tickBtn) return;
  tickBtn.classList.toggle("on", tickSoundEnabled);
  tickBtn.title = tickSoundEnabled ? "滴答声：开" : "滴答声：关";
}

noteInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    event.preventDefault();
    const start = noteInput.selectionStart ?? noteInput.value.length;
    const end = noteInput.selectionEnd ?? start;
    const value = noteInput.value;
    noteInput.value = `${value.slice(0, start)}\n${value.slice(end)}`;
    noteInput.selectionStart = noteInput.selectionEnd = start + 1;
    syncNoteInputHeight();
    persistDraft(true);
    return;
  }
  event.preventDefault();
  resetCountdown();
});

tickBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const next = !tickSoundEnabled;
  if (window.countdownApi?.setTickSoundEnabled) {
    tickSoundEnabled = await window.countdownApi.setTickSoundEnabled(next);
  } else {
    tickSoundEnabled = next;
  }
  renderTickButton();
  if (tickSoundEnabled) ensureAudio();
});

noteInput.addEventListener("input", () => {
  syncNoteInputHeight();
  persistDraft(true);
});

noteInput.addEventListener("change", () => {
  persistDraft(true);
});

if (window.countdownApi?.onReset) {
  window.countdownApi.onReset(() => {
    resetCountdown();
  });
}

if (window.countdownApi?.onFlushDraft) {
  window.countdownApi.onFlushDraft(() => {
    persistDraft(true);
  });
}

if (window.countdownApi?.onTickSoundChange) {
  window.countdownApi.onTickSoundChange((enabled) => {
    tickSoundEnabled = enabled;
    renderTickButton();
    if (enabled) ensureAudio();
  });
}

if (window.countdownApi?.getTickSoundEnabled) {
  window.countdownApi.getTickSoundEnabled().then((enabled) => {
    tickSoundEnabled = Boolean(enabled);
    renderTickButton();
  });
} else {
  renderTickButton();
}

document.addEventListener(
  "pointerdown",
  () => {
    ensureAudio();
  },
  { once: true }
);

window.addEventListener("beforeunload", () => {
  persistDraft(true);
});

function blockContextMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  return false;
}

document.addEventListener("contextmenu", blockContextMenu, true);
window.addEventListener("contextmenu", blockContextMenu, true);
document.addEventListener(
  "mouseup",
  (event) => {
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true
);
if (noteInput) {
  noteInput.addEventListener("contextmenu", blockContextMenu, true);
}

document.addEventListener("visibilitychange", () => {
  // After sleep/lock, reset wall baseline so the next frame doesn't count downtime.
  lastWallTick = Date.now();
});

window.addEventListener("focus", () => {
  lastWallTick = Date.now();
});

renderLoopCount(0);
syncNoteInputHeight();
requestAnimationFrame(() => {
  syncNoteInputHeight();
  requestAnimationFrame(update);
});
