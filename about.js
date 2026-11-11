const closeBtn = document.getElementById("closeBtn");
const githubBtn = document.getElementById("githubBtn");
const siteBtn = document.getElementById("siteBtn");
const timelineBtn = document.getElementById("timelineBtn");
const versionEl = document.getElementById("version");

window.aboutApi?.getInfo?.().then((info) => {
  if (info?.version) versionEl.textContent = info.version;
});

closeBtn.addEventListener("click", () => window.aboutApi?.close?.());
githubBtn.addEventListener("click", () => window.aboutApi?.openGithub?.());
siteBtn.addEventListener("click", () => window.aboutApi?.openWebsite?.());
timelineBtn.addEventListener("click", () => window.aboutApi?.openTimeline?.());
