const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  screen,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  DEFAULT_API_BASE,
  createAccountClient,
  mergeSessions,
} = require("./sync-account");

const ABOUT_GITHUB = "https://github.com/yixiaozi";
const ABOUT_WEBSITE = "https://wangyang.wiki/";
const TIMELINE_URL = "https://timeline.wangyang.wiki";
const APP_DISPLAY_NAME = "TickNote";

const WINDOW_WIDTH = 280;
const WINDOW_HEIGHT_BASE = 132;
const STATS_WIDTH = 520;
const STATS_HEIGHT = 640;
const STATS_MINI_WIDTH = 360;
const STATS_MINI_HEIGHT = 260;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let statsWindow = null;
/** @type {BrowserWindow | null} */
let settingsWindow = null;
/** @type {Tray | null} */
let tray = null;
let tickSoundEnabled = true;
/** @type {string} */
let dataDir = "";
/** @type {string} */
let machineName = "";
/** @type {string} */
let accountToken = "";
/** @type {string} */
let accountUsername = "";
/** @type {string} */
let syncApiBase = DEFAULT_API_BASE;
/** @type {string | null} */
let lastSyncAt = null;
/** @type {string[]} */
let dismissedGaps = [];
/** @type {NodeJS.Timeout | null} */
let syncTimer = null;
/** @type {BrowserWindow | null} */
let aboutWindow = null;

const accountApi = createAccountClient(() => ({
  apiBase: syncApiBase,
  token: accountToken,
}));

function detectPortableRoot() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.resolve(process.env.PORTABLE_EXECUTABLE_DIR);
  }
  try {
    if (app.isPackaged) {
      const exeDir = path.resolve(path.dirname(process.execPath));
      if (fs.existsSync(path.join(exeDir, "portable.json"))) {
        return exeDir;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

const PORTABLE_ROOT = detectPortableRoot();

function pointerPath() {
  return path.join(app.getPath("userData"), "datapath.json");
}

function getDataDir() {
  return dataDir || PORTABLE_ROOT || app.getPath("userData");
}

function SETTINGS_PATH() {
  return path.join(getDataDir(), "settings.json");
}

function SESSIONS_PATH() {
  return path.join(getDataDir(), "sessions.json");
}

function DRAFT_PATH() {
  return path.join(getDataDir(), "draft.json");
}

function loadDataPathConfig() {
  if (PORTABLE_ROOT) {
    dataDir = PORTABLE_ROOT;
    return true;
  }
  const cfg = readJson(pointerPath(), {});
  if (cfg && typeof cfg.dataDir === "string" && cfg.dataDir.trim()) {
    dataDir = path.resolve(cfg.dataDir.trim());
    return Boolean(cfg.configured);
  }
  dataDir = app.getPath("userData");
  return false;
}

function saveDataPathConfig(dir, configured = true) {
  dataDir = path.resolve(dir);
  writeJson(pointerPath(), {
    dataDir,
    configured: Boolean(configured),
  });
  if (PORTABLE_ROOT) {
    try {
      writeJson(path.join(PORTABLE_ROOT, "portable.json"), {
        dataDir: ".",
        configured: true,
      });
    } catch {
      // ignore
    }
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {
    // ignore
  }
}

function copyDataFile(fromPath, toPath) {
  if (!fs.existsSync(fromPath) || fromPath === toPath) return;
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  if (!fs.existsSync(toPath)) {
    fs.copyFileSync(fromPath, toPath);
  }
}

function migrateDataDir(fromDir, toDir) {
  if (!fromDir || !toDir || fromDir === toDir) return;
  fs.mkdirSync(toDir, { recursive: true });
  for (const name of ["sessions.json", "settings.json", "draft.json"]) {
    copyDataFile(path.join(fromDir, name), path.join(toDir, name));
  }
}

async function ensureDataDirectoryConfigured() {
  if (PORTABLE_ROOT) {
    saveDataPathConfig(PORTABLE_ROOT, true);
    migrateDataDir(app.getPath("userData"), PORTABLE_ROOT);
    return;
  }

  const alreadyConfigured = loadDataPathConfig();
  if (alreadyConfigured && fs.existsSync(getDataDir())) {
    try {
      fs.mkdirSync(getDataDir(), { recursive: true });
    } catch {
      // ignore
    }
    return;
  }

  const legacyDir = app.getPath("userData");
  const defaultDir = path.join(app.getPath("documents"), "TickNote");
  const result = await dialog.showMessageBox({
    type: "question",
    title: "选择数据存放位置",
    message: "首次使用 TickNote，请选择数据存放位置",
    detail:
      "统计记录、设置和草稿都会保存在这个文件夹。\n之后也可在托盘菜单中更改。",
    buttons: ["选择文件夹", "使用默认位置", "取消"],
    defaultId: 0,
    cancelId: 2,
  });

  let target = defaultDir;
  if (result.response === 0) {
    const picked = await dialog.showOpenDialog({
      title: "选择 TickNote 数据文件夹",
      defaultPath: defaultDir,
      properties: ["openDirectory", "createDirectory"],
    });
    if (!picked.canceled && picked.filePaths[0]) {
      target = picked.filePaths[0];
    }
  }

  saveDataPathConfig(target, true);
  migrateDataDir(legacyDir, target);
}

async function changeDataDirectory() {
  const current = getDataDir();
  const picked = await dialog.showOpenDialog({
    title: "选择新的数据存放位置",
    defaultPath: current,
    properties: ["openDirectory", "createDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) return;

  const next = path.resolve(picked.filePaths[0]);
  if (next === current) return;

  const migrate = await dialog.showMessageBox({
    type: "question",
    title: "迁移数据",
    message: "是否把现有数据复制到新位置？",
    detail: `当前：${current}\n新位置：${next}`,
    buttons: ["复制并切换", "仅切换（不复制）", "取消"],
    defaultId: 0,
    cancelId: 2,
  });
  if (migrate.response === 2) return;

  if (migrate.response === 0) {
    migrateDataDir(current, next);
  }

  saveDataPathConfig(next, true);
  loadSettings();
  broadcastSessions(loadSessions());
  refreshTrayMenu();
  broadcastSettings();
  dialog.showMessageBox({
    type: "info",
    title: "已更新",
    message: "数据目录已更改",
    detail: next,
    buttons: ["好的"],
  });
}
const statsPrefs = {
  alwaysOnTop: false,
  locked: false,
  opacity: 1,
  mini: false,
  showDevice: false,
  x: null,
  y: null,
  width: STATS_WIDTH,
  height: STATS_HEIGHT,
  miniX: null,
  miniY: null,
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

function defaultMachineName() {
  return (os.hostname() || "本机").trim() || "本机";
}

function getDeviceLabel() {
  const name = (machineName || defaultMachineName()).trim() || defaultMachineName();
  return `${name} · ${APP_DISPLAY_NAME}`;
}

function loadSettings() {
  const data = readJson(SETTINGS_PATH(), {});
  if (typeof data.tickSoundEnabled === "boolean") {
    tickSoundEnabled = data.tickSoundEnabled;
  }
  if (typeof data.machineName === "string" && data.machineName.trim()) {
    machineName = data.machineName.trim();
  } else {
    machineName = defaultMachineName();
  }
  if (typeof data.accountToken === "string") {
    accountToken = data.accountToken;
  }
  if (typeof data.accountUsername === "string") {
    accountUsername = data.accountUsername;
  }
  if (typeof data.syncApiBase === "string" && data.syncApiBase.trim()) {
    syncApiBase = data.syncApiBase.trim();
  }
  if (typeof data.lastSyncAt === "string") {
    lastSyncAt = data.lastSyncAt;
  }
  if (Array.isArray(data.dismissedGaps)) {
    dismissedGaps = data.dismissedGaps.map(String).slice(0, 2000);
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
    if (typeof data.stats.showDevice === "boolean") {
      statsPrefs.showDevice = data.stats.showDevice;
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
    if (typeof data.stats.miniX === "number") statsPrefs.miniX = data.stats.miniX;
    if (typeof data.stats.miniY === "number") statsPrefs.miniY = data.stats.miniY;
  }
}

function saveSettings() {
  try {
    writeJson(SETTINGS_PATH(), {
      tickSoundEnabled,
      machineName: machineName || defaultMachineName(),
      accountToken,
      accountUsername,
      syncApiBase,
      lastSyncAt,
      dismissedGaps,
      stats: { ...statsPrefs },
    });
  } catch {
    // Ignore persistence failures.
  }
}

function createCenteredPromptWindow({ width, height, title }) {
  const promptWindow = new BrowserWindow({
    width,
    height,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: false,
    hasShadow: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    show: false,
    center: true,
    title,
    backgroundColor: "#161a21",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
    },
  });
  promptWindow.setMenuBarVisibility(false);
  promptWindow.setSkipTaskbar(true);
  promptWindow.once("ready-to-show", () => {
    promptWindow.center();
    promptWindow.show();
    promptWindow.focus();
  });
  return promptWindow;
}

function promptText({ title, message, defaultValue }) {
  return new Promise((resolve) => {
    const promptWindow = createCenteredPromptWindow({
      width: 400,
      height: 210,
      title,
    });

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (!promptWindow.isDestroyed()) promptWindow.close();
      resolve(value);
    };

    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" />
<style>
  html,body{margin:0;height:100%;background:#161a21;color:#e8edf5;font:14px/1.4 "Segoe UI","Microsoft YaHei",sans-serif}
  body{display:flex;flex-direction:column;padding:16px;box-sizing:border-box;gap:10px;-webkit-app-region:drag;border:1px solid #2a3342}
  h1{margin:0;font-size:15px;font-weight:700}
  p{margin:0;opacity:.86;font-size:13px;-webkit-app-region:no-drag}
  input{width:100%;box-sizing:border-box;border:1px solid #2d3542;border-radius:8px;background:#0f1319;color:#e8edf5;padding:9px 10px;outline:none;-webkit-app-region:no-drag}
  input:focus{border-color:#5b8def}
  .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:auto;-webkit-app-region:no-drag}
  button{border:0;border-radius:8px;padding:7px 14px;cursor:pointer;font:inherit}
  .cancel{background:#2a313c;color:#d7dde8}
  .ok{background:#3d6fd8;color:#fff}
</style></head><body>
  <h1>${title.replace(/[<>&]/g, "")}</h1>
  <p id="msg"></p>
  <input id="value" spellcheck="false" />
  <div class="actions">
    <button class="cancel" id="cancel" type="button">取消</button>
    <button class="ok" id="ok" type="button">确定</button>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const input = document.getElementById("value");
    document.getElementById("msg").textContent = ${JSON.stringify(message)};
    input.value = ${JSON.stringify(defaultValue || "")};
    const submit = () => ipcRenderer.send("prompt:result", input.value);
    const cancel = () => ipcRenderer.send("prompt:result", null);
    document.getElementById("ok").onclick = submit;
    document.getElementById("cancel").onclick = cancel;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
      if (e.key === "Escape") cancel();
    });
    input.focus();
    input.select();
  </script>
</body></html>`;

    const onResult = (_event, value) => {
      if (_event.sender !== promptWindow.webContents) return;
      ipcMain.removeListener("prompt:result", onResult);
      finish(typeof value === "string" ? value : null);
    };
    ipcMain.on("prompt:result", onResult);
    promptWindow.on("closed", () => {
      ipcMain.removeListener("prompt:result", onResult);
      finish(null);
    });
    promptWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );
  });
}

function rewriteSessionDevices(oldName, oldLabel, newLabel) {
  const now = new Date().toISOString();
  const sessions = loadSessions().map((session) => {
    const current = String(session.device || "").trim();
    const shouldRewrite =
      !current ||
      current === oldLabel ||
      current === oldName ||
      (oldName && current.startsWith(`${oldName} ·`)) ||
      (oldLabel && current === oldLabel);
    if (!shouldRewrite) return session;
    return {
      ...session,
      device: newLabel,
      updatedAt: now,
    };
  });
  saveSessions(sessions);
  broadcastSessions(sessions);
  return sessions.length;
}

async function changeMachineName() {
  const current = machineName || defaultMachineName();
  const oldName = current;
  const oldLabel = getDeviceLabel();
  const next = await promptText({
    title: "设置机器名",
    message: "用于区分哪台电脑写下的记录（保存为「机器名 · TickNote」）",
    defaultValue: current,
  });
  if (next === null) return;
  const trimmed = String(next).trim();
  if (!trimmed) return;
  machineName = trimmed;
  const newLabel = getDeviceLabel();
  rewriteSessionDevices(oldName, oldLabel, newLabel);
  // Also rewrite host-based leftovers from this PC.
  rewriteSessionDevices(
    defaultMachineName(),
    `${defaultMachineName()} · ${APP_DISPLAY_NAME}`,
    newLabel
  );
  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
  syncNow({ quiet: true }).catch(() => {});
}

function promptCredentials({ title, submitLabel }) {
  return new Promise((resolve) => {
    const promptWindow = createCenteredPromptWindow({
      width: 400,
      height: 240,
      title,
    });

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (!promptWindow.isDestroyed()) promptWindow.close();
      resolve(value);
    };

    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" />
<style>
  html,body{margin:0;height:100%;background:#161a21;color:#e8edf5;font:14px/1.4 "Segoe UI","Microsoft YaHei",sans-serif}
  body{display:flex;flex-direction:column;padding:16px;box-sizing:border-box;gap:8px;-webkit-app-region:drag;border:1px solid #2a3342}
  h1{margin:0 0 4px;font-size:15px;font-weight:700}
  label{display:grid;gap:4px;font-size:12px;color:#9aa6b8;-webkit-app-region:no-drag}
  input{width:100%;box-sizing:border-box;border:1px solid #2d3542;border-radius:8px;background:#0f1319;color:#e8edf5;padding:9px 10px;outline:none}
  input:focus{border-color:#5b8def}
  .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:auto;-webkit-app-region:no-drag}
  button{border:0;border-radius:8px;padding:7px 14px;cursor:pointer;font:inherit}
  .cancel{background:#2a313c;color:#d7dde8}
  .ok{background:#3d6fd8;color:#fff}
</style></head><body>
  <h1>${title.replace(/[<>&]/g, "")}</h1>
  <label>用户名<input id="username" spellcheck="false" /></label>
  <label>密码<input id="password" type="password" /></label>
  <div class="actions">
    <button class="cancel" id="cancel" type="button">取消</button>
    <button class="ok" id="ok" type="button">${submitLabel}</button>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const submit = () => ipcRenderer.send("prompt:creds", {
      username: username.value,
      password: password.value
    });
    const cancel = () => ipcRenderer.send("prompt:creds", null);
    document.getElementById("ok").onclick = submit;
    document.getElementById("cancel").onclick = cancel;
    password.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    username.addEventListener("keydown", (e) => {
      if (e.key === "Enter") password.focus();
      if (e.key === "Escape") cancel();
    });
    username.focus();
  </script>
</body></html>`;

    const onResult = (_event, value) => {
      if (_event.sender !== promptWindow.webContents) return;
      ipcMain.removeListener("prompt:creds", onResult);
      finish(value && typeof value === "object" ? value : null);
    };
    ipcMain.on("prompt:creds", onResult);
    promptWindow.on("closed", () => {
      ipcMain.removeListener("prompt:creds", onResult);
      finish(null);
    });
    promptWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );
  });
}

async function accountLoginOrRegister(mode) {
  const creds = await promptCredentials({
    title: mode === "register" ? "注册 TickNote 账号" : "登录 TickNote 账号",
    submitLabel: mode === "register" ? "注册" : "登录",
  });
  if (!creds) return;
  const username = String(creds.username || "").trim();
  const password = String(creds.password || "");
  if (!username || password.length < 6) {
    dialog.showErrorBox("无法继续", "请填写用户名，密码至少 6 位");
    return;
  }
  try {
    const result =
      mode === "register"
        ? await accountApi.register(username, password)
        : await accountApi.login(username, password);
    accountToken = result.token;
    accountUsername = result.user?.username || username;
    saveSettings();
    refreshTrayMenu();
    broadcastSettings();
    await syncNow({ quiet: true });
  } catch (err) {
    dialog.showErrorBox(
      mode === "register" ? "注册失败" : "登录失败",
      err.message || String(err)
    );
    throw err;
  }
}

function logoutAccount() {
  accountToken = "";
  accountUsername = "";
  lastSyncAt = null;
  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
}

function formatLastSyncLabel() {
  if (!lastSyncAt) return "上次同步：尚未同步";
  const d = new Date(lastSyncAt);
  if (Number.isNaN(d.getTime())) return "上次同步：—";
  const p = (n) => String(n).padStart(2, "0");
  return `上次同步：${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function getSettingsPayload() {
  return {
    syncApiBase: syncApiBase || DEFAULT_API_BASE,
    machineName: machineName || defaultMachineName(),
    dataDir: getDataDir(),
    accountUsername,
    lastSyncAt,
    lastSyncLabel: formatLastSyncLabel(),
  };
}

function broadcastSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", getSettingsPayload());
  }
}

async function pushLocalSessions() {
  if (!accountToken) return;
  const sessions = loadSessions().map((s) => ({
    ...s,
    updatedAt: s.updatedAt || s.endedAt || s.startedAt || new Date().toISOString(),
  }));
  await accountApi.push(sessions);
}

async function pullRemoteSessions() {
  if (!accountToken) return;
  const payload = await accountApi.pull();
  const merged = mergeSessions(loadSessions(), payload.sessions || []);
  saveSessions(merged);
  broadcastSessions(merged);
  lastSyncAt = payload.serverTime || new Date().toISOString();
  saveSettings();
}

async function syncNow({ quiet = true } = {}) {
  if (!accountToken) {
    if (!quiet) {
      dialog.showMessageBox({
        type: "info",
        title: "尚未登录",
        message: "请先注册或登录后再同步",
        buttons: ["好的"],
      });
    }
    return;
  }
  try {
    // Pull remote first so other devices' data is merged in, then push full set.
    await pullRemoteSessions();
    await pushLocalSessions();
    lastSyncAt = new Date().toISOString();
    saveSettings();
    refreshTrayMenu();
    broadcastSettings();
    if (!quiet) {
      dialog.showMessageBox({
        type: "info",
        title: "同步完成",
        message: "已双向同步：拉取其他设备数据并上传本机记录",
        detail: syncApiBase || TIMELINE_URL,
        buttons: ["好的"],
      });
    }
  } catch (err) {
    if (!quiet) {
      dialog.showErrorBox("同步失败", err.message || String(err));
    }
    throw err;
  }
}

function startSyncTimer() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    syncNow({ quiet: true }).catch(() => {});
  }, 5 * 60 * 1000);
}

function getStatsPrefsPayload() {
  return {
    alwaysOnTop: statsPrefs.alwaysOnTop,
    locked: statsPrefs.locked,
    opacity: statsPrefs.opacity,
    mini: statsPrefs.mini,
    showDevice: statsPrefs.showDevice,
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

function pinMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setSkipTaskbar(true);
}

function applyStatsWindowPrefs() {
  if (!statsWindow || statsWindow.isDestroyed()) return;

  // Use screen-saver level so pinned stats stays above ordinary apps on Windows.
  statsWindow.setAlwaysOnTop(Boolean(statsPrefs.alwaysOnTop), "screen-saver");
  statsWindow.setOpacity(statsPrefs.opacity);
  statsWindow.setMovable(!statsPrefs.locked);
  statsWindow.setResizable(!statsPrefs.mini);
  statsWindow.webContents.send("stats:prefs", getStatsPrefsPayload());
}

/** Shared Cut/Copy/Paste menu for editable fields across all windows. */
function attachEditContextMenu(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.on("context-menu", (event, params) => {
    event.preventDefault();
    if (win.isDestroyed()) return;
    const editable = Boolean(params.isEditable);
    const hasSelection = Boolean(params.selectionText);
    if (!editable && !hasSelection) return;

    const template = editable
      ? [
          { role: "undo", enabled: Boolean(params.editFlags?.canUndo) },
          { role: "redo", enabled: Boolean(params.editFlags?.canRedo) },
          { type: "separator" },
          { role: "cut", enabled: Boolean(params.editFlags?.canCut) },
          { role: "copy", enabled: Boolean(params.editFlags?.canCopy) },
          { role: "paste", enabled: Boolean(params.editFlags?.canPaste) },
          { role: "delete", enabled: Boolean(params.editFlags?.canDelete) },
          { type: "separator" },
          { role: "selectAll", enabled: Boolean(params.editFlags?.canSelectAll) },
        ]
      : [{ role: "copy", enabled: Boolean(params.editFlags?.canCopy) }];

    Menu.buildFromTemplate(template).popup({ window: win });
  });
}

function sessionsFingerprint(sessions) {
  if (!Array.isArray(sessions)) return "";
  return sessions
    .map(
      (s) =>
        `${s.id}|${s.updatedAt || ""}|${s.note || ""}|${s.minutes || 0}|${s.deleted ? 1 : 0}`
    )
    .join(";");
}

let lastBroadcastFingerprint = "";

function broadcastSessions(sessions, { force = false } = {}) {
  if (!statsWindow || statsWindow.isDestroyed()) return;
  const fp = sessionsFingerprint(sessions);
  if (!force && fp === lastBroadcastFingerprint) return;
  lastBroadcastFingerprint = fp;
  statsWindow.webContents.send("stats:data", sessions);
}

function rememberStatsBounds() {
  if (!statsWindow || statsWindow.isDestroyed()) return;
  if (statsPrefs.locked) return;

  const bounds = statsWindow.getBounds();
  if (statsPrefs.mini) {
    statsPrefs.miniX = bounds.x;
    statsPrefs.miniY = bounds.y;
  } else {
    statsPrefs.x = bounds.x;
    statsPrefs.y = bounds.y;
    statsPrefs.width = bounds.width;
    statsPrefs.height = bounds.height;
    statsPrefs.normalX = bounds.x;
    statsPrefs.normalY = bounds.y;
    statsPrefs.normalWidth = bounds.width;
    statsPrefs.normalHeight = bounds.height;
  }
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
    const miniBounds = getMiniBounds();
    const hasMiniPos =
      typeof statsPrefs.miniX === "number" &&
      typeof statsPrefs.miniY === "number";
    statsWindow.setBounds(
      {
        width: miniBounds.width,
        height: miniBounds.height,
        x: hasMiniPos ? statsPrefs.miniX : miniBounds.x,
        y: hasMiniPos ? statsPrefs.miniY : miniBounds.y,
      },
      false
    );
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

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function normalizeSession(session, existingId) {
  const device =
    typeof session.device === "string" && session.device.trim()
      ? session.device.trim()
      : getDeviceLabel();
  const endedAt = session.endedAt || new Date().toISOString();
  return {
    id: existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    note: String(session.note || "").trim() || "未命名",
    rounds: Math.max(0, Number(session.rounds) || 0),
    minutes: Math.max(0, Number(session.minutes) || 0),
    device,
    startedAt: session.startedAt || null,
    endedAt,
    updatedAt: session.updatedAt || endedAt,
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

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    settingsWindow.webContents.send("settings:changed", getSettingsPayload());
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 460,
    height: 560,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    show: false,
    center: true,
    backgroundColor: "#12161c",
    title: "TickNote 设置",
    webPreferences: {
      preload: path.join(__dirname, "preload-settings.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.setSkipTaskbar(true);
  settingsWindow.setAlwaysOnTop(true, "floating");
  attachEditContextMenu(settingsWindow);
  settingsWindow.loadFile("settings.html");
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.center();
    settingsWindow?.show();
  });
  settingsWindow.webContents.on("did-finish-load", () => {
    settingsWindow?.webContents.send("settings:changed", getSettingsPayload());
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
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
    skipTaskbar: true,
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
  statsWindow.setSkipTaskbar(true);
  attachEditContextMenu(statsWindow);
  statsWindow.loadFile("stats.html");

  statsWindow.webContents.on("did-finish-load", () => {
    lastBroadcastFingerprint = "";
    statsWindow?.webContents.send("stats:data", loadSessions());
    applyStatsWindowPrefs();
  });

  statsWindow.once("ready-to-show", () => {
    applyStatsWindowPrefs();
    statsWindow?.show();
  });

  statsWindow.on("blur", () => {
    if (!statsPrefs.alwaysOnTop) return;
    setTimeout(applyStatsWindowPrefs, 0);
    setTimeout(applyStatsWindowPrefs, 80);
    setTimeout(applyStatsWindowPrefs, 250);
  });
  statsWindow.on("focus", () => {
    if (statsPrefs.alwaysOnTop) applyStatsWindowPrefs();
  });

  statsWindow.on("moved", () => {
    rememberStatsBounds();
  });

  statsWindow.on("resized", () => {
    rememberStatsBounds();
  });

  statsWindow.on("closed", () => {
    statsWindow = null;
  });
}

function showAboutDialog() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 440,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    center: true,
    backgroundColor: "#00000000",
    title: "关于 TickNote",
    webPreferences: {
      preload: path.join(__dirname, "preload-about.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  aboutWindow.setMenuBarVisibility(false);
  aboutWindow.setSkipTaskbar(true);
  aboutWindow.setAlwaysOnTop(true, "floating");
  attachEditContextMenu(aboutWindow);
  aboutWindow.loadFile("about.html");
  aboutWindow.once("ready-to-show", () => {
    aboutWindow?.center();
    aboutWindow?.show();
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
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
      label: "设置…",
      click: () => openSettingsWindow(),
    },
    {
      label: "重置轮次与计时",
      click: () => {
        sendToRenderer("countdown:reset");
      },
    },
    { type: "separator" },
    {
      label: accountUsername
        ? `账号: ${accountUsername}`
        : "账号: 未登录",
      enabled: false,
    },
    {
      label: formatLastSyncLabel(),
      enabled: false,
    },
    ...(accountToken
      ? [
          {
            label: "立即同步",
            click: () => {
              syncNow({ quiet: false }).catch(() => {});
            },
          },
        ]
      : []),
    {
      label: "打开同步网站",
      click: () => {
        shell.openExternal(syncApiBase || TIMELINE_URL);
      },
    },
    { type: "separator" },
    {
      label: "关于 TickNote",
      click: () => {
        showAboutDialog();
      },
    },
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
  pinMainWindow();
  mainWindow.setClosable(false);

  mainWindow.loadFile("index.html");
  attachEditContextMenu(mainWindow);

  mainWindow.webContents.on("did-finish-load", () => {
    sendToRenderer("countdown:tick-sound", tickSoundEnabled);
  });

  mainWindow.once("ready-to-show", () => {
    pinMainWindow();
    mainWindow?.show();
  });

  // Windows may briefly drop always-on-top when the note input blurs.
  mainWindow.on("blur", () => {
    setTimeout(pinMainWindow, 0);
    setTimeout(pinMainWindow, 80);
    setTimeout(pinMainWindow, 250);
  });
  mainWindow.on("focus", () => pinMainWindow());
  mainWindow.on("show", () => pinMainWindow());

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

ipcMain.handle("countdown:set-tick-sound", (_event, enabled) => {
  tickSoundEnabled = Boolean(enabled);
  saveSettings();
  refreshTrayMenu();
  sendToRenderer("countdown:tick-sound", tickSoundEnabled);
  return tickSoundEnabled;
});

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
  if (typeof patch.showDevice === "boolean") {
    statsPrefs.showDevice = patch.showDevice;
  }

  if (wasMini !== statsPrefs.mini) {
    applyMiniLayout(statsPrefs.mini);
  }

  saveSettings();
  applyStatsWindowPrefs();
  return getStatsPrefsPayload();
});

ipcMain.handle("sessions:list", () => loadSessions());

ipcMain.handle("sessions:dismissed-gaps", () => dismissedGaps);

ipcMain.handle("sessions:dismiss-gap", (_event, gapId) => {
  const id = String(gapId || "").trim();
  if (!id) return dismissedGaps;
  if (!dismissedGaps.includes(id)) {
    dismissedGaps.unshift(id);
    dismissedGaps = dismissedGaps.slice(0, 2000);
    saveSettings();
  }
  return dismissedGaps;
});

ipcMain.handle("sessions:add", (_event, session) => {
  if (!session || typeof session !== "object") {
    return loadSessions();
  }

  const sessions = loadSessions();
  sessions.unshift(normalizeSession(session));
  saveSessions(sessions);
  clearDraft();
  broadcastSessions(sessions, { force: true });
  syncNow({ quiet: true }).catch(() => {});
  return sessions;
});

ipcMain.handle("sessions:update", (_event, payload) => {
  if (!payload || !payload.id) return loadSessions();

  const sessions = loadSessions();
  const index = sessions.findIndex((s) => s.id === payload.id);
  if (index < 0) return sessions;

  const current = sessions[index];
  const now = new Date().toISOString();
  sessions[index] = normalizeSession(
    {
      ...current,
      note: payload.note !== undefined ? payload.note : current.note,
      rounds: payload.rounds !== undefined ? payload.rounds : current.rounds,
      minutes: payload.minutes !== undefined ? payload.minutes : current.minutes,
      device: current.device || getDeviceLabel(),
      startedAt:
        payload.startedAt !== undefined ? payload.startedAt : current.startedAt,
      endedAt: payload.endedAt !== undefined ? payload.endedAt : current.endedAt,
      updatedAt: now,
    },
    current.id
  );

  saveSessions(sessions);
  // Skip immediate broadcast: caller already has return value; avoids list flash
  // while focus leaves the note. Sync will broadcast only if merge changes data.
  lastBroadcastFingerprint = sessionsFingerprint(sessions);
  // Push first so remote gets the edit before any pull/merge.
  pushLocalSessions()
    .then(() => syncNow({ quiet: true }))
    .catch(() => {});
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

ipcMain.handle("settings:get", () => getSettingsPayload());

ipcMain.handle("settings:save", async (_event, patch) => {
  if (!patch || typeof patch !== "object") return getSettingsPayload();

  if (typeof patch.syncApiBase === "string") {
    const next = patch.syncApiBase.trim().replace(/\/$/, "");
    if (next) {
      try {
        const url = new URL(next);
        if (!/^https?:$/.test(url.protocol)) {
          throw new Error("同步地址需以 http:// 或 https:// 开头");
        }
        syncApiBase = url.origin + (url.pathname === "/" ? "" : url.pathname);
      } catch (err) {
        throw new Error(err.message || "同步地址无效");
      }
    } else {
      syncApiBase = DEFAULT_API_BASE;
    }
  }

  if (typeof patch.machineName === "string") {
    const trimmed = patch.machineName.trim();
    if (trimmed) {
      const oldName = machineName || defaultMachineName();
      const oldLabel = getDeviceLabel();
      machineName = trimmed;
      const newLabel = getDeviceLabel();
      rewriteSessionDevices(oldName, oldLabel, newLabel);
      rewriteSessionDevices(
        defaultMachineName(),
        `${defaultMachineName()} · ${APP_DISPLAY_NAME}`,
        newLabel
      );
    }
  }

  saveSettings();
  refreshTrayMenu();
  broadcastSettings();
  syncNow({ quiet: true }).catch(() => {});
  return getSettingsPayload();
});

ipcMain.handle("settings:login", async () => {
  await accountLoginOrRegister("login");
  return getSettingsPayload();
});

ipcMain.handle("settings:register", async () => {
  await accountLoginOrRegister("register");
  return getSettingsPayload();
});

ipcMain.handle("settings:logout", () => {
  logoutAccount();
  return getSettingsPayload();
});

ipcMain.handle("settings:sync", async () => {
  await syncNow({ quiet: true });
  return getSettingsPayload();
});

ipcMain.handle("settings:change-data-dir", async () => {
  await changeDataDirectory();
  broadcastSettings();
  return getSettingsPayload();
});

ipcMain.handle("settings:open-data-dir", async () => {
  await shell.openPath(getDataDir());
  return true;
});

ipcMain.on("settings:close", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

ipcMain.handle("about:get-info", () => ({
  version: app.getVersion(),
}));

ipcMain.on("about:open-github", () => {
  shell.openExternal(ABOUT_GITHUB);
});

ipcMain.on("about:open-website", () => {
  shell.openExternal(ABOUT_WEBSITE);
});

ipcMain.on("about:open-timeline", () => {
  shell.openExternal(syncApiBase || TIMELINE_URL);
});

ipcMain.on("about:close", () => {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.close();
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

  app.whenReady().then(async () => {
    await ensureDataDirectoryConfigured();
    loadSettings();
    consumeDraftOnStartup();

    if (process.platform === "darwin" && app.dock) {
      app.dock.hide();
    }

    createWindow();
    createTray();
    startSyncTimer();
    if (accountToken) {
      syncNow({ quiet: true }).catch(() => {});
    }

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
