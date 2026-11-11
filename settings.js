const closeBtn = document.getElementById("closeBtn");
const accountStatus = document.getElementById("accountStatus");
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

function showMsg(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", Boolean(isError));
  el.classList.remove("hidden");
}

function applySettings(data) {
  syncApiBaseInput.value = data.syncApiBase || "";
  machineNameInput.value = data.machineName || "";
  dataDirLabel.textContent = `数据目录：${data.dataDir || "—"}`;
  accountStatus.textContent = data.accountUsername
    ? `已登录：${data.accountUsername}`
    : "未登录";
  lastSyncLabel.textContent = data.lastSyncLabel || "上次同步：—";
  logoutBtn.disabled = !data.accountUsername;
  syncBtn.disabled = !data.accountUsername;
}

async function refresh() {
  const data = await window.settingsApi.get();
  applySettings(data);
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

loginBtn.addEventListener("click", async () => {
  accountMsg.classList.add("hidden");
  try {
    await window.settingsApi.login();
    await refresh();
    showMsg(accountMsg, "登录成功");
  } catch (err) {
    showMsg(accountMsg, err.message || String(err), true);
  }
});

registerBtn.addEventListener("click", async () => {
  accountMsg.classList.add("hidden");
  try {
    await window.settingsApi.register();
    await refresh();
    showMsg(accountMsg, "注册成功");
  } catch (err) {
    showMsg(accountMsg, err.message || String(err), true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await window.settingsApi.logout();
  await refresh();
  showMsg(accountMsg, "已退出登录");
});

syncBtn.addEventListener("click", async () => {
  accountMsg.classList.add("hidden");
  try {
    await window.settingsApi.sync();
    await refresh();
    showMsg(accountMsg, "同步完成");
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
  try {
    const data = await window.settingsApi.save({
      syncApiBase: syncApiBaseInput.value.trim(),
      machineName: machineNameInput.value.trim(),
    });
    applySettings(data);
    showMsg(saveMsg, "已保存");
  } catch (err) {
    showMsg(saveMsg, err.message || String(err), true);
  }
});

if (window.settingsApi?.onChanged) {
  window.settingsApi.onChanged((data) => applySettings(data));
}

refresh().catch(() => {});
