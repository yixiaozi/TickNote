const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("countdownApi", {
  setTrayLabel(label) {
    ipcRenderer.send("countdown:tick", label);
  },
  getTickSoundEnabled() {
    return ipcRenderer.invoke("countdown:get-tick-sound");
  },
  onTickSoundChange(callback) {
    const listener = (_event, enabled) => callback(Boolean(enabled));
    ipcRenderer.on("countdown:tick-sound", listener);
    return () => ipcRenderer.removeListener("countdown:tick-sound", listener);
  },
  onReset(callback) {
    const listener = () => callback();
    ipcRenderer.on("countdown:reset", listener);
    return () => ipcRenderer.removeListener("countdown:reset", listener);
  },
  onFlushDraft(callback) {
    const listener = () => callback();
    ipcRenderer.on("countdown:flush-draft", listener);
    return () => ipcRenderer.removeListener("countdown:flush-draft", listener);
  },
  addSession(session) {
    return ipcRenderer.invoke("sessions:add", session);
  },
  saveDraft(draft) {
    return ipcRenderer.invoke("sessions:save-draft", draft);
  },
  clearDraft() {
    return ipcRenderer.invoke("sessions:clear-draft");
  },
  openStats() {
    ipcRenderer.send("stats:open");
  },
  resizeHeight(contentHeight) {
    ipcRenderer.send("countdown:resize-height", contentHeight);
  },
});
