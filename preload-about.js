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
});
