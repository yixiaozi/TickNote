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
const {
  createLocalMcpServer,
  newLocalMcpToken,
} = require("./mcp-local");
const { t, setLocale, normalizeLocale } = require("./i18n");

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
let mcpEnabled = false;
let mcpPort = 3927;
/** @type {string} */
let mcpToken = "";
/** @type {string} */
let mcpLastError = "";
/** @type {"en" | "zh"} */
let appLocale = "en";
/** @type {ReturnType<typeof createLocalMcpServer> | null} */
let localMcp = null;
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
  locale: appLocale,
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
    title: t("dialog.data_first_title"),
    message: t("dialog.data_first_msg"),
    detail: t("dialog.data_first_detail"),
    buttons: [
      t("dialog.data_pick"),
      t("dialog.data_default"),
      t("dialog.data_cancel"),
    ],
    defaultId: 0,
    cancelId: 2,
  });

  let target = defaultDir;
  if (result.response === 0) {
    const picked = await dialog.showOpenDialog({
      title: t("dialog.data_folder_title"),
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
    title: t("dialog.data_new_title"),
    defaultPath: current,
    properties: ["openDirectory", "createDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) return;

  const next = path.resolve(picked.filePaths[0]);
  if (next === current) return;

  const migrate = await dialog.showMessageBox({
    type: "question",
    title: t("dialog.migrate_title"),
    message: t("dialog.migrate_msg"),
    detail: t("dialog.migrate_detail", { current, next }),
    buttons: [
      t("dialog.migrate_copy"),
      t("dialog.migrate_switch"),
      t("dialog.data_cancel"),
    ],
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
    title: t("dialog.updated_title"),
    message: t("dialog.updated_msg"),
    detail: next,
    buttons: [t("common.ok")],
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
  return (os.hostname() || t("common.local_machine")).trim() || t("common.local_machine");
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
  if (typeof data.mcpEnabled === "boolean") {
    mcpEnabled = data.mcpEnabled;
  }
  if (typeof data.mcpPort === "number" && data.mcpPort > 0 && data.mcpPort < 65536) {
    mcpPort = Math.floor(data.mcpPort);
  }
  if (typeof data.mcpToken === "string") {
    mcpToken = data.mcpToken;
  }
  if (typeof data.locale === "string") {
    appLocale = normalizeLocale(data.locale);
    setLocale(appLocale);
  } else {
    appLocale = "en";
    setLocale("en");
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
      mcpEnabled,
      mcpPort,
      mcpToken,
      locale: appLocale || "en",
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
    <button class="cancel" id="cancel" type="button">${t("common.cancel")}</button>
    <button class="ok" id="ok" type="button">${t("common.ok")}</button>
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
    title: t("dialog.machine_title"),
    message: t("dialog.machine_msg"),
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
  <label>${t("dialog.auth_username")}<input id="username" spellcheck="false" /></label>
  <label>${t("dialog.auth_password")}<input id="password" type="password" /></label>
  <div class="actions">
    <button class="cancel" id="cancel" type="button">${t("common.cancel")}</button>
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
    title:
      mode === "register" ? t("dialog.auth_register") : t("dialog.auth_login"),
    submitLabel:
      mode === "register"
        ? t("dialog.auth_register_btn")
        : t("dialog.auth_login_btn"),
  });
  if (!creds) return;
  const username = String(creds.username || "").trim();
  const password = String(creds.password || "");
  if (!username || password.length < 6) {
    dialog.showErrorBox(
      t("dialog.auth_need_continue"),
      t("dialog.auth_need_fields")
    );
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
      mode === "register"
        ? t("dialog.auth_fail_register")
        : t("dialog.auth_fail_login"),
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
  if (!lastSyncAt) {
    return `${t("settings.last_sync_prefix")}${t("settings.last_sync_never")}`;
  }
  const d = new Date(lastSyncAt);
  if (Number.isNaN(d.getTime())) {
    return `${t("settings.last_sync_prefix")}${t("common.dash")}`;
  }
  const p = (n) => String(n).padStart(2, "0");
  return `${t("settings.last_sync_prefix")}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function ensureLocalMcp() {
  if (localMcp) return localMcp;
  localMcp = createLocalMcpServer({
    port: mcpPort,
    getSessions: () => loadSessions(),
    getToken: () => mcpToken,
    getInfo: () => ({
      app: APP_DISPLAY_NAME,
      machineName: machineName || defaultMachineName(),
      deviceLabel: getDeviceLabel(),
      dataDir: getDataDir(),
      accountUsername: accountUsername || "",
      syncApiBase: syncApiBase || DEFAULT_API_BASE,
    }),
  });
  return localMcp;
}

async function syncLocalMcpServer() {
  const mcp = ensureLocalMcp();
  if (!mcpEnabled) {
    await mcp.stop();
    mcpLastError = "";
    return mcp.status();
  }
  try {
    await mcp.start(mcpPort);
    mcpLastError = "";
  } catch (err) {
    mcpLastError = err?.message || String(err);
    try {
      await mcp.stop();
    } catch {
      // ignore
    }
    throw err;
  }
  return mcp.status();
}

function getSettingsPayload() {
  const mcpStatus = localMcp ? localMcp.status() : { running: false, port: mcpPort, url: "" };
  return {
    syncApiBase: syncApiBase || DEFAULT_API_BASE,
    machineName: machineName || defaultMachineName(),
    dataDir: getDataDir(),
    accountUsername,
    lastSyncAt,
    lastSyncLabel: formatLastSyncLabel(),
    mcpEnabled,
    mcpPort,
    mcpHasToken: Boolean(mcpToken),
    mcpTokenPreview: mcpToken ? `${mcpToken.slice(0, 8)}…` : "",
    mcpRunning: Boolean(mcpStatus.running),
    mcpLastError,
    locale: appLocale || "en",
    mcpUrl: mcpStatus.url || `http://127.0.0.1:${mcpPort}/mcp`,
  };
}

function broadcastSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", getSettingsPayload());
  }
}

function broadcastLocale() {
  const locale = appLocale || "en";
  setLocale(locale);
  for (const win of [mainWindow, statsWindow, settingsWindow, aboutWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("app:locale", locale);
    }
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", getSettingsPayload());
  }
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.webContents.send("about:locale", locale);
  }
  refreshTrayMenu();
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
  const adjacent = mergeAdjacentIdenticalSessions(merged);
  saveSessions(adjacent.sessions);
  broadcastSessions(adjacent.sessions);
  lastSyncAt = payload.serverTime || new Date().toISOString();
  saveSettings();
}

async function syncNow({ quiet = true } = {}) {
  if (!accountToken) {
    if (!quiet) {
      dialog.showMessageBox({
        type: "info",
        title: t("dialog.sync_need_login_title"),
        message: t("dialog.sync_need_login_msg"),
        buttons: [t("common.ok")],
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
        title: t("dialog.sync_ok_title"),
        message: t("dialog.sync_ok_msg"),
        detail: syncApiBase || TIMELINE_URL,
        buttons: [t("common.ok")],
      });
    }
  } catch (err) {
    if (!quiet) {
      dialog.showErrorBox(t("dialog.sync_fail"), err.message || String(err));
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

function minutesFromRange(startedAt, endedAt, fallback = 0) {
  const start = startedAt ? new Date(startedAt).getTime() : NaN;
  const end = endedAt ? new Date(endedAt).getTime() : NaN;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return Math.max(0, Number(fallback) || 0);
  }
  return Math.round(((end - start) / 60_000) * 10) / 10;
}

function loadSessions() {
  const data = readJson(SESSIONS_PATH(), []);
  return Array.isArray(data) ? data : [];
}

function saveSessions(sessions) {
  writeJson(SESSIONS_PATH(), sessions);
}

const ADJACENT_MERGE_MS = 5000;

function noteMergeKey(note) {
  const n = String(note || "").trim();
  if (!n || n === "未命名" || n === "Untitled") return "";
  return n;
}

function sessionRangeMs(session) {
  const start = new Date(session.startedAt || session.endedAt || 0).getTime();
  const end = new Date(session.endedAt || session.startedAt || 0).getTime();
  return {
    start: Number.isNaN(start) ? 0 : start,
    end: Number.isNaN(end) ? 0 : end,
  };
}

/** Merge back-to-back sessions with the same note (and device when both set). */
function mergeAdjacentIdenticalSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 2) {
    return { sessions: sessions || [], changed: false };
  }

  const ordered = [...sessions].sort((a, b) => {
    const ra = sessionRangeMs(a);
    const rb = sessionRangeMs(b);
    if (ra.start !== rb.start) return ra.start - rb.start;
    return ra.end - rb.end;
  });

  const absorbed = new Set();
  const kept = [];
  let changed = false;

  for (let i = 0; i < ordered.length; i += 1) {
    const seed = ordered[i];
    if (!seed || absorbed.has(seed.id)) continue;

    let cur = { ...seed };
    let { start: curStart, end: curEnd } = sessionRangeMs(cur);
    let key = noteMergeKey(cur.note);
    let device = String(cur.device || "").trim();
    let grew = true;

    while (grew) {
      grew = false;
      for (let j = 0; j < ordered.length; j += 1) {
        const other = ordered[j];
        if (!other || absorbed.has(other.id) || other.id === cur.id) continue;
        if (noteMergeKey(other.note) !== key) continue;
        const otherDevice = String(other.device || "").trim();
        if (device && otherDevice && device !== otherDevice) continue;

        const { start: oStart, end: oEnd } = sessionRangeMs(other);
        const abuts =
          Math.abs(oStart - curEnd) <= ADJACENT_MERGE_MS ||
          Math.abs(curStart - oEnd) <= ADJACENT_MERGE_MS;
        if (!abuts) continue;

        const newStart = Math.min(curStart, oStart);
        const newEnd = Math.max(curEnd, oEnd);
        const startedAt = new Date(newStart).toISOString();
        const endedAt = new Date(newEnd).toISOString();
        cur = {
          ...cur,
          note: cur.note || other.note || "",
          startedAt,
          endedAt,
          minutes: minutesFromRange(
            startedAt,
            endedAt,
            (Number(cur.minutes) || 0) + (Number(other.minutes) || 0)
          ),
          rounds:
            Math.max(0, Number(cur.rounds) || 0) +
            Math.max(0, Number(other.rounds) || 0),
          device: device || otherDevice,
          updatedAt: new Date().toISOString(),
        };
        absorbed.add(other.id);
        curStart = newStart;
        curEnd = newEnd;
        if (!device && otherDevice) device = otherDevice;
        changed = true;
        grew = true;
      }
    }

    kept.push(cur);
  }

  kept.sort((a, b) => {
    const ta = sessionRangeMs(a).end;
    const tb = sessionRangeMs(b).end;
    return tb - ta;
  });

  return { sessions: kept, changed };
}

/** Recompute minutes from start/end so history matches the time range. */
function repairSessionDurations() {
  const sessions = loadSessions();
  if (!sessions.length) return sessions;
  const now = new Date().toISOString();
  let changed = false;
  const next = sessions.map((raw) => {
    const startedAt = raw.startedAt || null;
    const endedAt = raw.endedAt || raw.updatedAt || null;
    const minutes = minutesFromRange(startedAt, endedAt, raw.minutes);
    const prev = Math.round((Number(raw.minutes) || 0) * 10) / 10;
    if (Math.abs(minutes - prev) <= 0.05) {
      return raw;
    }
    changed = true;
    return {
      ...raw,
      minutes,
      rounds: Math.max(0, Number(raw.rounds) || 0),
      updatedAt: now,
    };
  });
  const merged = mergeAdjacentIdenticalSessions(next);
  if (changed || merged.changed) {
    saveSessions(merged.sessions);
  }
  return merged.sessions;
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
  const startedAt = session.startedAt || null;
  const endedAt = session.endedAt || new Date().toISOString();
  const minutes = minutesFromRange(startedAt, endedAt, session.minutes);
  return {
    id: existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    note: String(session.note || "").trim() || t("common.unnamed"),
    rounds: Math.max(0, Number(session.rounds) || 0),
    minutes,
    device,
    startedAt,
    endedAt,
    updatedAt: session.updatedAt || endedAt,
  };
}

function isMeaningful(session) {
  if (!session) return false;
  const minutes = minutesFromRange(
    session.startedAt,
    session.endedAt || session.updatedAt,
    session.minutes
  );
  return minutes >= 0.2;
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
    width: 520,
    height: 640,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    show: false,
    center: true,
    backgroundColor: "#0f141b",
    title: t("settings.title"),
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
    title: t("stats.title"),
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
    title: t("about.title"),
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
      label: t("tray.show"),
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: t("tray.hide"),
      click: () => {
        mainWindow?.hide();
      },
    },
    { type: "separator" },
    {
      label: t("tray.tick"),
      type: "checkbox",
      checked: tickSoundEnabled,
      click: (item) => {
        tickSoundEnabled = item.checked;
        saveSettings();
        sendToRenderer("countdown:tick-sound", tickSoundEnabled);
      },
    },
    {
      label: t("tray.stats"),
      click: () => openStatsWindow(),
    },
    {
      label: t("tray.settings"),
      click: () => openSettingsWindow(),
    },
    {
      label: t("tray.reset"),
      click: () => {
        sendToRenderer("countdown:reset");
      },
    },
    { type: "separator" },
    {
      label: accountUsername
        ? t("tray.account_user", { name: accountUsername })
        : t("tray.account_none"),
      enabled: false,
    },
    {
      label: formatLastSyncLabel(),
      enabled: false,
    },
    ...(accountToken
      ? [
          {
            label: t("tray.sync_now"),
            click: () => {
              syncNow({ quiet: false }).catch(() => {});
            },
          },
        ]
      : []),
    {
      label: t("tray.open_site"),
      click: () => {
        shell.openExternal(syncApiBase || TIMELINE_URL);
      },
    },
    { type: "separator" },
    {
      label: t("tray.about"),
      click: () => {
        showAboutDialog();
      },
    },
    {
      label: t("tray.quit"),
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
  // Main countdown HUD: never show a context menu.
  mainWindow.webContents.on("context-menu", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "mouseDown" && input.button === "right") {
      event.preventDefault();
    }
  });
  if (process.platform === "win32" && typeof mainWindow.hookWindowMessage === "function") {
    // WM_CONTEXTMENU / WM_RBUTTONUP — swallow native shell menu on frameless HUD.
    mainWindow.hookWindowMessage(0x007b, () => {});
    mainWindow.hookWindowMessage(0x0205, () => {});
  }

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
  const merged = mergeAdjacentIdenticalSessions(sessions);
  saveSessions(merged.sessions);
  clearDraft();
  broadcastSessions(merged.sessions, { force: true });
  syncNow({ quiet: true }).catch(() => {});
  return merged.sessions;
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
    note: String(draft.note || "").trim() || t("common.unnamed"),
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
          throw new Error(t("dialog.bad_sync_url"));
        }
        syncApiBase = url.origin + (url.pathname === "/" ? "" : url.pathname);
      } catch (err) {
        throw new Error(err.message || t("dialog.bad_sync_url_generic"));
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

  if (typeof patch.locale === "string") {
    const nextLocale = normalizeLocale(patch.locale);
    if (nextLocale !== appLocale) {
      appLocale = nextLocale;
      setLocale(appLocale);
      broadcastLocale();
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

ipcMain.handle("settings:mcp-save", async (_event, patch) => {
  if (!patch || typeof patch !== "object") return getSettingsPayload();
  if (typeof patch.enabled === "boolean") mcpEnabled = patch.enabled;
  if (typeof patch.port === "number" && patch.port > 1023 && patch.port < 65536) {
    mcpPort = Math.floor(patch.port);
  }
  saveSettings();
  try {
    await syncLocalMcpServer();
  } catch (err) {
    throw new Error(t("dialog.mcp_start_fail", { err: err.message || err }));
  }
  broadcastSettings();
  return getSettingsPayload();
});

ipcMain.handle("settings:mcp-rotate-token", async () => {
  mcpToken = newLocalMcpToken();
  saveSettings();
  if (mcpEnabled) {
    try {
      await syncLocalMcpServer();
    } catch {
      // keep token even if restart fails
    }
  }
  broadcastSettings();
  return { ...getSettingsPayload(), mcpToken };
});

ipcMain.handle("settings:mcp-revoke-token", async () => {
  mcpToken = "";
  saveSettings();
  if (mcpEnabled) {
    try {
      await syncLocalMcpServer();
    } catch {
      // ignore
    }
  }
  broadcastSettings();
  return getSettingsPayload();
});

ipcMain.on("settings:close", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

ipcMain.handle("app:get-locale", () => appLocale || "en");

ipcMain.handle("about:get-info", () => ({
  version: app.getVersion(),
  locale: appLocale || "en",
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
    repairSessionDurations();

    if (process.platform === "darwin" && app.dock) {
      app.dock.hide();
    }

    Menu.setApplicationMenu(null);
    createWindow();
    createTray();
    startSyncTimer();
    syncLocalMcpServer().catch((err) => {
      mcpLastError = err?.message || String(err);
    });
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
  if (localMcp) {
    localMcp.stop().catch(() => {});
  }
});
