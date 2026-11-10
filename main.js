const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  screen,
  ipcMain,
} = require("electron");
const fs = require("fs");
const path = require("path");

const WINDOW_WIDTH = 280;
const WINDOW_HEIGHT_BASE = 132;
const STATS_WIDTH = 520;
const STATS_HEIGHT = 640;
const STATS_MINI_WIDTH = 360;
const STATS_MINI_HEIGHT = 260;
const SETTINGS_PATH = () => path.join(app.getPath("userData"), "settings.json");
const SESSIONS_PATH = () => path.join(app.getPath("userData"), "sessions.json");
const DRAFT_PATH = () => path.join(app.getPath("userData"), "draft.json");

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let statsWindow = null;
/** @type {Tray | null} */
let tray = null;
let tickSoundEnabled = true;
const statsPrefs = {
  alwaysOnTop: false,
  locked: false,
  opacity: 1,
  mini: false,
  x: null,
  y: null,
  width: STATS_WIDTH,
  height: STATS_HEIGHT,
  normalX: null,
  normalY: null,
  normalWidth: STATS_WIDTH,
  normalHeight: STATS_HEIGHT,
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadSettings() {
  const data = readJson(SETTINGS_PATH(), {});
  if (typeof data.tickSoundEnabled === "boolean") {
    tickSoundEnabled = data.tickSoundEnabled;
  }
  if (data.stats && typeof data.stats === "object") {
    if (typeof data.stats.alwaysOnTop === "boolean") {
      statsPrefs.alwaysOnTop = data.stats.alwaysOnTop;
    }
    if (typeof data.stats.locked === "boolean") {
      statsPrefs.locked = data.stats.locked;
    }
    if (typeof data.stats.opacity === "number") {
      statsPrefs.opacity = Math.min(1, Math.max(0.45, data.stats.opacity));
    }
    if (typeof data.stats.mini === "boolean") {
      statsPrefs.mini = data.stats.mini;
    }
    if (typeof data.stats.x === "number") statsPrefs.x = data.stats.x;
    if (typeof data.stats.y === "number") statsPrefs.y = data.stats.y;
    if (typeof data.stats.width === "number") statsPrefs.width = data.stats.width;
    if (typeof data.stats.height === "number") {
      statsPrefs.height = data.stats.height;
    }
    if (typeof data.stats.normalX === "number") {
      statsPrefs.normalX = data.stats.normalX;
    }
    if (typeof data.stats.normalY === "number") {
      statsPrefs.normalY = data.stats.normalY;
    }
    if (typeof data.stats.normalWidth === "number") {
      statsPrefs.normalWidth = data.stats.normalWidth;
    }
    if (typeof data.stats.normalHeight === "number") {
      statsPrefs.normalHeight = data.stats.normalHeight;
    }
  }
}

function saveSettings() {
  try {
    writeJson(SETTINGS_PATH(), {
      tickSoundEnabled,
      stats: { ...statsPrefs },
    });
  } catch {
    // Ignore persistence failures.
  }
}

function getStatsPrefsPayload() {
  return {
    alwaysOnTop: statsPrefs.alwaysOnTop,
    locked: statsPrefs.locked,
    opacity: statsPrefs.opacity,
    mini: statsPrefs.mini,
  };
}

function getMiniBounds() {
  const display = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width, height } = display.workArea;
  return {
    width: STATS_MINI_WIDTH,
    height: STATS_MINI_HEIGHT,
    x: workX + width - STATS_MINI_WIDTH - 16,
    y: workY + height - STATS_MINI_HEIGHT - 16,
  };
}

function applyStatsWindowPrefs() {
  if (!statsWindow || statsWindow.isDestroyed()) return;

  statsWindow.setAlwaysOnTop(
    Boolean(statsPrefs.alwaysOnTop || statsPrefs.mini),
    "floating"
  );
  statsWindow.setOpacity(statsPrefs.opacity);
  statsWindow.setMovable(!statsPrefs.locked && !statsPrefs.mini);
  statsWindow.setResizable(!statsPrefs.mini);
  statsWindow.webContents.send("stats:prefs", getStatsPrefsPayload());
}

function rememberStatsBounds() {
  if (!statsWindow || statsWindow.isDestroyed()) return;
  if (statsPrefs.mini) return;

  const bounds = statsWindow.getBounds();
  statsPrefs.x = bounds.x;
  statsPrefs.y = bounds.y;
  statsPrefs.width = bounds.width;
  statsPrefs.height = bounds.height;
  statsPrefs.normalX = bounds.x;
  statsPrefs.normalY = bounds.y;
  statsPrefs.normalWidth = bounds.width;
  statsPrefs.normalHeight = bounds.height;
  saveSettings();
}

function applyMiniLayout(enteringMini) {
  if (!statsWindow || statsWindow.isDestroyed()) return;

  if (enteringMini) {
    const current = statsWindow.getBounds();
    statsPrefs.normalX = current.x;
    statsPrefs.normalY = current.y;
    statsPrefs.normalWidth = current.width;
    statsPrefs.normalHeight = current.height;
    statsWindow.setBounds(getMiniBounds(), false);
  } else {
    const display = screen.getPrimaryDisplay();
    const { x: workX, y: workY, width, height } = display.workArea;
    const restoreWidth = statsPrefs.normalWidth || STATS_WIDTH;
    const restoreHeight = statsPrefs.normalHeight || STATS_HEIGHT;
    const hasNormal =
      typeof statsPrefs.normalX === "number" &&
      typeof statsPrefs.normalY === "number";
    statsWindow.setBounds(
      {
        width: restoreWidth,
        height: restoreHeight,
        x: hasNormal
          ? statsPrefs.normalX
          : workX + Math.round((width - restoreWidth) / 2),
        y: hasNormal
          ? statsPrefs.normalY
          : workY + Math.round((height - restoreHeight) / 2),
      },
      false
    );
  }
}

function loadSessions() {
  const data = readJson(SESSIONS_PATH(), []);
  return Array.isArray(data) ? data : [];
}

function saveSessions(sessions) {
  writeJson(SESSIONS_PATH(), sessions);
}

function loadDraft() {
  const data = readJson(DRAFT_PATH(), null);
  return data && typeof data === "object" ? data : null;
}

function saveDraft(draft) {
  writeJson(DRAFT_PATH(), draft);
}

function clearDraft() {
  try {
    fs.unlinkSync(DRAFT_PATH());
  } catch {
    // already gone
  }
}

function broadcastSessions(sessions) {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.webContents.send("stats:data", sessions);
  }
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function normalizeSession(session, existingId) {
  return {
    id: existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    note: String(session.note || "").trim() || "未命名",
    rounds: Math.max(0, Number(session.rounds) || 0),
    minutes: Math.max(0, Number(session.minutes) || 0),
    startedAt: session.startedAt || null,
    endedAt: session.endedAt || new Date().toISOString(),
  };
}

function isMeaningful(session) {
  if (!session) return false;
  const rounds = Number(session.rounds) || 0;
  const minutes = Number(session.minutes) || 0;
  return rounds > 0 || minutes >= 0.2;
}

/** Promote unfinished draft into permanent history after crash/force quit. */
function consumeDraftOnStartup() {
  const draft = loadDraft();
  if (!isMeaningful(draft)) {
    clearDraft();
    return;
  }

  const sessions = loadSessions();
  sessions.unshift(
    normalizeSession({
      ...draft,
      endedAt: draft.endedAt || draft.updatedAt || new Date().toISOString(),
    })
  );
  saveSessions(sessions);
  clearDraft();
}

function openStatsWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.show();
    statsWindow.focus();
    statsWindow.webContents.send("stats:data", loadSessions());
    applyStatsWindowPrefs();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const { x: workX, y: workY } = display.workArea;
  const miniBounds = getMiniBounds();
  const width = statsPrefs.mini
    ? miniBounds.width
    : statsPrefs.width || STATS_WIDTH;
  const height = statsPrefs.mini
    ? miniBounds.height
    : statsPrefs.height || STATS_HEIGHT;
  const hasSavedPos =
    !statsPrefs.mini &&
    typeof statsPrefs.x === "number" &&
    typeof statsPrefs.y === "number";

  statsWindow = new BrowserWindow({
    width,
    height,
    x: statsPrefs.mini
      ? miniBounds.x
      : hasSavedPos
        ? statsPrefs.x
        : workX + Math.round((screenWidth - width) / 2),
    y: statsPrefs.mini
      ? miniBounds.y
      : hasSavedPos
        ? statsPrefs.y
        : workY + Math.round((screenHeight - height) / 2),
    frame: false,
    transparent: false,
    resizable: !statsPrefs.mini,
    minimizable: false,
    maximizable: false,
    show: false,
    autoHideMenuBar: true,
    title: "TickNote 统计",
    backgroundColor: "#12161c",
    webPreferences: {
      preload: path.join(__dirname, "preload-stats.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  statsWindow.setMenuBarVisibility(false);
  statsWindow.loadFile("stats.html");

  statsWindow.webContents.on("did-finish-load", () => {
    statsWindow?.webContents.send("stats:data", loadSessions());
    applyStatsWindowPrefs();
  });

  statsWindow.once("ready-to-show", () => {
    applyStatsWindowPrefs();
    statsWindow?.show();
  });

  statsWindow.on("moved", () => {
    if (!statsPrefs.locked) rememberStatsBounds();
  });

  statsWindow.on("resized", () => {
    rememberStatsBounds();
  });

  statsWindow.on("closed", () => {
    statsWindow = null;
  });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "隐藏窗口",
      click: () => {
        mainWindow?.hide();
      },
    },
    { type: "separator" },
    {
      label: "每秒滴答声",
      type: "checkbox",
      checked: tickSoundEnabled,
      click: (item) => {
        tickSoundEnabled = item.checked;
        saveSettings();
        sendToRenderer("countdown:tick-sound", tickSoundEnabled);
      },
    },
    {
      label: "查看统计",
      click: () => openStatsWindow(),
    },
    {
      label: "重置轮次与计时",
      click: () => {
        sendToRenderer("countdown:reset");
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        if (mainWindow) {
          mainWindow.setClosable(true);
        }
        app.quit();
      },
    },
  ]);
}

function refreshTrayMenu() {
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
  }
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth } = display.workAreaSize;
  const { x: workX, y: workY } = display.workArea;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT_BASE,
    x: workX + screenWidth - WINDOW_WIDTH - 24,
    y: workY + 24,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    thickFrame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setBackgroundColor("#00000000");
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setClosable(false);

  mainWindow.loadFile("index.html");

  mainWindow.webContents.on("did-finish-load", () => {
    sendToRenderer("countdown:tick-sound", tickSoundEnabled);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray.png");
  let icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }

  if (process.platform === "darwin") {
    icon = icon.resize({ width: 16, height: 16 });
    icon.setTemplateImage(true);
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip("TickNote — 1:00");
  refreshTrayMenu();

  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.on("countdown:tick", (_event, label) => {
  if (tray && typeof label === "string") {
    tray.setToolTip(`TickNote — ${label}`);
  }
});

ipcMain.handle("countdown:get-tick-sound", () => tickSoundEnabled);

ipcMain.on("countdown:resize-height", (_event, contentHeight) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const height = Math.max(
    WINDOW_HEIGHT_BASE,
    Math.min(280, Math.round(Number(contentHeight) || WINDOW_HEIGHT_BASE))
  );
  const bounds = mainWindow.getBounds();
  if (bounds.height === height) return;
  mainWindow.setBounds({ ...bounds, height }, false);
});

ipcMain.handle("stats:get-prefs", () => getStatsPrefsPayload());

ipcMain.handle("stats:set-prefs", (_event, patch) => {
  if (!patch || typeof patch !== "object") return getStatsPrefsPayload();

  const wasMini = statsPrefs.mini;

  if (typeof patch.alwaysOnTop === "boolean") {
    statsPrefs.alwaysOnTop = patch.alwaysOnTop;
  }
  if (typeof patch.locked === "boolean") {
    statsPrefs.locked = patch.locked;
  }
  if (typeof patch.opacity === "number") {
    statsPrefs.opacity = Math.min(1, Math.max(0.45, patch.opacity));
  }
  if (typeof patch.mini === "boolean") {
    statsPrefs.mini = patch.mini;
  }

  if (wasMini !== statsPrefs.mini) {
    applyMiniLayout(statsPrefs.mini);
  }

  saveSettings();
  applyStatsWindowPrefs();
  return getStatsPrefsPayload();
});

ipcMain.handle("sessions:list", () => loadSessions());

ipcMain.handle("sessions:add", (_event, session) => {
  if (!session || typeof session !== "object") {
    return loadSessions();
  }

  const sessions = loadSessions();
  sessions.unshift(normalizeSession(session));
  saveSessions(sessions);
  clearDraft();
  broadcastSessions(sessions);
  return sessions;
});

ipcMain.handle("sessions:update", (_event, payload) => {
  if (!payload || !payload.id) return loadSessions();

  const sessions = loadSessions();
  const index = sessions.findIndex((s) => s.id === payload.id);
  if (index < 0) return sessions;

  const current = sessions[index];
  sessions[index] = normalizeSession(
    {
      ...current,
      note: payload.note !== undefined ? payload.note : current.note,
      rounds: payload.rounds !== undefined ? payload.rounds : current.rounds,
      minutes: payload.minutes !== undefined ? payload.minutes : current.minutes,
      startedAt:
        payload.startedAt !== undefined ? payload.startedAt : current.startedAt,
      endedAt: payload.endedAt !== undefined ? payload.endedAt : current.endedAt,
    },
    current.id
  );

  saveSessions(sessions);
  broadcastSessions(sessions);
  return sessions;
});

ipcMain.handle("sessions:save-draft", (_event, draft) => {
  if (!draft || typeof draft !== "object") return false;
  if (!isMeaningful(draft)) {
    clearDraft();
    return false;
  }
  saveDraft({
    note: String(draft.note || "").trim() || "未命名",
    rounds: Math.max(0, Number(draft.rounds) || 0),
    minutes: Math.max(0, Number(draft.minutes) || 0),
    startedAt: draft.startedAt || null,
    endedAt: draft.endedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return true;
});

ipcMain.handle("sessions:clear-draft", () => {
  clearDraft();
  return true;
});

ipcMain.on("stats:open", () => {
  openStatsWindow();
});

ipcMain.on("stats:close", () => {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.close();
  }
});

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (process.platform === "win32") {
  app.disableHardwareAcceleration();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    loadSettings();
    consumeDraftOnStartup();

    if (process.platform === "darwin" && app.dock) {
      app.dock.hide();
    }

    createWindow();
    createTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow?.show();
      }
    });
  });
}

app.on("window-all-closed", () => {
  // Keep running in tray on all platforms; only tray Quit exits.
});

app.on("before-quit", () => {
  sendToRenderer("countdown:flush-draft");
  if (mainWindow) {
    mainWindow.setClosable(true);
  }
});
