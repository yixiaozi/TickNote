const { contextBridge, ipcRenderer } = require("electron");

// Locale lives in the settings payload as `locale` (get/save).
contextBridge.exposeInMainWorld("settingsApi", {
  get() {
    return ipcRenderer.invoke("settings:get");
  },
  save(patch) {
    return ipcRenderer.invoke("settings:save", patch);
  },
  getLocale() {
    return ipcRenderer
      .invoke("settings:get")
      .then((data) => data?.locale || "en");
  },

  login() {
    return ipcRenderer.invoke("settings:login");
  },
  register() {
    return ipcRenderer.invoke("settings:register");
  },
  logout() {
    return ipcRenderer.invoke("settings:logout");
  },
  sync() {
    return ipcRenderer.invoke("settings:sync");
  },
  changeDataDir() {
    return ipcRenderer.invoke("settings:change-data-dir");
  },
  openDataDir() {
    return ipcRenderer.invoke("settings:open-data-dir");
  },
  mcpSave(patch) {
    return ipcRenderer.invoke("settings:mcp-save", patch);
  },
  mcpRotateToken() {
    return ipcRenderer.invoke("settings:mcp-rotate-token");
  },
  mcpRevokeToken() {
    return ipcRenderer.invoke("settings:mcp-revoke-token");
  },
  close() {
    ipcRenderer.send("settings:close");
  },
  onChanged(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
});
