const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
  get() {
    return ipcRenderer.invoke("settings:get");
  },
  save(patch) {
    return ipcRenderer.invoke("settings:save", patch);
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
  close() {
    ipcRenderer.send("settings:close");
  },
  onChanged(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
});
