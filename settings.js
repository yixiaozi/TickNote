const { t, applyI18n, setLocale, getLocale } = window.TickNoteI18n;

const closeBtn = document.getElementById("closeBtn");
const accountStatus = document.getElementById("accountStatus");
const accountBadge = document.getElementById("accountBadge");
const lastSyncLabel = document.getElementById("lastSyncLabel");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const syncBtn = document.getElementById("syncBtn");
const accountMsg = document.getElementById("accountMsg");
const syncApiBaseInput = document.getElementById("syncApiBase");
const machineNameInput = document.getElementById("machineName");
const dataDirLabel = document.getElementById("dataDirLabel");
const changeDataDirBtn = document.getElementById("changeDataDirBtn");
const openDataDirBtn = document.getElementById("openDataDirBtn");
const saveBtn = document.getElementById("saveBtn");
const saveMsg = document.getElementById("saveMsg");
const mcpEnabled = document.getElementById("mcpEnabled");
const mcpPort = document.getElementById("mcpPort");
const mcpBadge = document.getElementById("mcpBadge");
const mcpStatusText = document.getElementById("mcpStatusText");
const mcpUrlText = document.getElementById("mcpUrlText");
const mcpTokenStatus = document.getElementById("mcpTokenStatus");
const mcpTokenOnce = document.getElementById("mcpTokenOnce");
const mcpConfig = document.getElementById("mcpConfig");
const mcpRotateBtn = document.getElementById("mcpRotateBtn");
const mcpRevokeBtn = document.getElementById("mcpRevokeBtn");
const mcpCopyBtn = document.getElementById("mcpCopyBtn");
const mcpMsg = document.getElementById("mcpMsg");
const localeSelect = document.getElementById("localeSelect");

let latestMcpToken = "";
/** @type {any} */
let latestSettings = null;

function showMsg(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", Boolean(isError));
  el.classList.remove("hidden");
}

function mcpSnippet(url, token) {
  const auth = token || t("settings.mcp_token_placeholder");
  return `{
  "mcpServers": {
    "ticknote-local": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${auth}"
      }
    }
  }
}`;
}

function formatLastSyncDisplay(raw) {
  const text = String(raw || "").trim();
  const stripped = text
    .replace(/^上次同步：/, "")
    .replace(/^Last sync:\s*/i, "")
    .trim();
  if (
    !stripped ||
    stripped === "尚未同步" ||
    stripped === "Never synced" ||
    /never/i.test(stripped)
  ) {
    if (!text || /尚未同步|Never synced|never/i.test(text)) {
      return t("settings.last_sync_never");
    }
  }
  if (!stripped || stripped === "—" || stripped === "-") {
    return t("common.dash");
  }
  if (stripped === "尚未同步" || stripped === "Never synced") {
    return t("settings.last_sync_never");
  }
  return stripped;
}

function applyLocaleFromSettings(data) {
  const locale = data?.locale || "en";
  setLocale(locale);
  applyI18n();
  document.title = t("settings.title");
  if (localeSelect) localeSelect.value = getLocale();
}

function applySettings(data) {
  latestSettings = data;
  syncApiBaseInput.value = data.syncApiBase || "";
  machineNameInput.value = data.machineName || "";
  dataDirLabel.textContent = data.dataDir || t("common.dash");
  if (localeSelect && data.locale) {
    localeSelect.value = getLocale();
  }

  const loggedIn = Boolean(data.accountUsername);
  accountStatus.textContent = loggedIn
    ? data.accountUsername
    : t("settings.logged_out");
  accountBadge.textContent = loggedIn
    ? t("settings.logged_in")
    : t("settings.logged_out");
  accountBadge.classList.toggle("on", loggedIn);
  lastSyncLabel.textContent = formatLastSyncDisplay(data.lastSyncLabel);
  logoutBtn.disabled = !loggedIn;
  syncBtn.disabled = !loggedIn;

  mcpEnabled.checked = Boolean(data.mcpEnabled);
  mcpPort.value = String(data.mcpPort || 3927);
  const running = Boolean(data.mcpRunning);
  const enabled = Boolean(data.mcpEnabled);
  const errText = String(data.mcpLastError || "").trim();
  mcpBadge.textContent = running
    ? t("settings.mcp_on")
    : enabled
      ? t("settings.mcp_error")
      : t("settings.mcp_off");
  mcpBadge.classList.toggle("on", running);
  mcpStatusText.textContent = running
    ? t("settings.mcp_on")
    : enabled
      ? errText
        ? t("settings.not_running_err", { err: errText })
        : t("settings.not_running")
      : t("settings.not_running");
  mcpUrlText.textContent = data.mcpUrl || t("common.dash");
  const mcpErrorText = document.getElementById("mcpErrorText");
  if (mcpErrorText) {
    if (enabled && !running && errText) {
      mcpErrorText.textContent = t("settings.mcp_start_fail", { err: errText });
      mcpErrorText.classList.remove("hidden");
    } else {
      mcpErrorText.textContent = "";
      mcpErrorText.classList.add("hidden");
    }
  }
  mcpTokenStatus.textContent = data.mcpHasToken
    ? t("settings.token_on", {
        preview: data.mcpTokenPreview ? ` (${data.mcpTokenPreview})` : "",
      })
    : t("settings.token_none");
  mcpConfig.textContent = mcpSnippet(
    data.mcpUrl || `http://127.0.0.1:${data.mcpPort || 3927}/mcp`,
    latestMcpToken || undefined
  );
}

function hydrateFromSettings(data) {
  applyLocaleFromSettings(data);
  applySettings(data);
}

async function applyMcpNow({ showSuccess = false } = {}) {
  mcpMsg.classList.add("hidden");
  const port = Number(mcpPort.value);
  try {
    const data = await window.settingsApi.mcpSave({
      enabled: mcpEnabled.checked,
      port: Number.isFinite(port) ? port : 3927,
    });
    hydrateFromSettings(data);
    if (showSuccess) {
      showMsg(
        mcpMsg,
        data.mcpRunning
          ? t("settings.mcp_started")
          : data.mcpEnabled
            ? t("settings.mcp_enabled_stopped")
            : t("settings.mcp_stopped")
      );
    }
    return data;
  } catch (err) {
    showMsg(mcpMsg, err.message || String(err), true);
    await refresh();
    throw err;
  }
}

async function refresh() {
  const data = await window.settingsApi.get();
  hydrateFromSettings(data);
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((el) => {
      el.classList.toggle("active", el === tab);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${name}`);
    });
  });
});

closeBtn.addEventListener("click", () => window.settingsApi.close());

localeSelect?.addEventListener("change", async () => {
  const locale = localeSelect.value || "en";
  setLocale(locale);
  applyI18n();
  document.title = t("settings.title");
  if (latestSettings) applySettings(latestSettings);
  try {
    const data = await window.settingsApi.save({ locale });
    hydrateFromSettings(data);
  } catch (err) {
    showMsg(saveMsg, err.message || String(err), true);
  }
});

loginBtn.addEventListener("click", async () => {
  accountMsg.classList.add("hidden");
  try {
    await window.settingsApi.login();
    await refresh();
    showMsg(accountMsg, t("settings.login_ok"));
  } catch (err) {
    showMsg(accountMsg, err.message || String(err), true);
  }
});

registerBtn.addEventListener("click", async () => {
  accountMsg.classList.add("hidden");
  try {
    await window.settingsApi.register();
    await refresh();
    showMsg(accountMsg, t("settings.register_ok"));
  } catch (err) {
    showMsg(accountMsg, err.message || String(err), true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await window.settingsApi.logout();
  await refresh();
  showMsg(accountMsg, t("settings.logout_ok"));
});

syncBtn.addEventListener("click", async () => {
  accountMsg.classList.add("hidden");
  try {
    await window.settingsApi.sync();
    await refresh();
    showMsg(accountMsg, t("settings.sync_ok"));
  } catch (err) {
    showMsg(accountMsg, err.message || String(err), true);
  }
});

changeDataDirBtn.addEventListener("click", async () => {
  try {
    await window.settingsApi.changeDataDir();
    await refresh();
  } catch (err) {
    showMsg(saveMsg, err.message || String(err), true);
  }
});

openDataDirBtn.addEventListener("click", async () => {
  await window.settingsApi.openDataDir();
});

saveBtn.addEventListener("click", async () => {
  saveMsg.classList.add("hidden");
  mcpMsg.classList.add("hidden");
  try {
    const data = await window.settingsApi.save({
      syncApiBase: syncApiBaseInput.value.trim(),
      machineName: machineNameInput.value.trim(),
      locale: localeSelect?.value || getLocale(),
    });
    hydrateFromSettings(data);
    await applyMcpNow();
    await refresh();
    showMsg(saveMsg, t("settings.saved"));
  } catch (err) {
    showMsg(saveMsg, err.message || String(err), true);
  }
});

mcpEnabled.addEventListener("change", () => {
  applyMcpNow({ showSuccess: true }).catch(() => {});
});

mcpPort.addEventListener("change", () => {
  if (!mcpEnabled.checked) return;
  applyMcpNow({ showSuccess: true }).catch(() => {});
});

mcpRotateBtn.addEventListener("click", async () => {
  mcpMsg.classList.add("hidden");
  try {
    const data = await window.settingsApi.mcpRotateToken();
    latestMcpToken = data.mcpToken || "";
    mcpTokenOnce.textContent = t("settings.token_new", {
      token: latestMcpToken,
    });
    mcpTokenOnce.classList.remove("hidden");
    hydrateFromSettings(data);
    showMsg(mcpMsg, t("settings.token_updated"));
  } catch (err) {
    showMsg(mcpMsg, err.message || String(err), true);
  }
});

mcpRevokeBtn.addEventListener("click", async () => {
  mcpMsg.classList.add("hidden");
  try {
    latestMcpToken = "";
    mcpTokenOnce.classList.add("hidden");
    const data = await window.settingsApi.mcpRevokeToken();
    hydrateFromSettings(data);
    showMsg(mcpMsg, t("settings.token_revoked"));
  } catch (err) {
    showMsg(mcpMsg, err.message || String(err), true);
  }
});

mcpCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(mcpConfig.textContent || "");
    showMsg(mcpMsg, t("settings.copied"));
  } catch {
    showMsg(mcpMsg, t("settings.copy_fail"), true);
  }
});

if (window.settingsApi?.onChanged) {
  window.settingsApi.onChanged((data) => hydrateFromSettings(data));
}

setLocale("en");
applyI18n();
refresh().catch(() => {});
