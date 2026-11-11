const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("statsApi", {
  list() {
    return ipcRenderer.invoke("sessions:list");
  },
  add(session) {
    return ipcRenderer.invoke("sessions:add", session);
  },
  update(payload) {
    return ipcRenderer.invoke("sessions:update", payload);
  },
  dismissGap(gapId) {
    return ipcRenderer.invoke("sessions:dismiss-gap", gapId);
  },
  getDismissedGaps() {
    return ipcRenderer.invoke("sessions:dismissed-gaps");
  },
  close() {
    ipcRenderer.send("stats:close");
  },
  getPrefs() {
    return ipcRenderer.invoke("stats:get-prefs");
  },
  setPrefs(patch) {
    return ipcRenderer.invoke("stats:set-prefs", patch);
  },
  onPrefs(callback) {
    const listener = (_event, prefs) => callback(prefs);
    ipcRenderer.on("stats:prefs", listener);
    return () => ipcRenderer.removeListener("stats:prefs", listener);
  },
  onData(callback) {
    const listener = (_event, sessions) => callback(sessions);
    ipcRenderer.on("stats:data", listener);
    return () => ipcRenderer.removeListener("stats:data", listener);
  },
});
