const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aboutApi", {
  getInfo() {
    return ipcRenderer.invoke("about:get-info");
  },
  openGithub() {
    ipcRenderer.send("about:open-github");
  },
  openWebsite() {
    ipcRenderer.send("about:open-website");
  },
  openTimeline() {
    ipcRenderer.send("about:open-timeline");
  },
  close() {
    ipcRenderer.send("about:close");
  },
  onLocaleChange(callback) {
    const listener = (_event, locale) => callback(locale);
    ipcRenderer.on("app:locale", listener);
    return () => ipcRenderer.removeListener("app:locale", listener);
  },
  onChanged(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
});
