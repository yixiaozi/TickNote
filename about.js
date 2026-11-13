const { t, applyI18n, setLocale } = window.TickNoteI18n;

const closeBtn = document.getElementById("closeBtn");
const githubBtn = document.getElementById("githubBtn");
const siteBtn = document.getElementById("siteBtn");
const timelineBtn = document.getElementById("timelineBtn");
const versionEl = document.getElementById("version");

function applyLocale(locale) {
  setLocale(locale || "en");
  applyI18n();
  document.title = t("about.title");
}

applyLocale("en");

window.aboutApi?.getInfo?.().then((info) => {
  if (info?.locale) applyLocale(info.locale);
  if (info?.version) versionEl.textContent = info.version;
});

if (window.aboutApi?.onChanged) {
  window.aboutApi.onChanged((payload) => {
    if (payload?.locale) applyLocale(payload.locale);
    if (payload?.version) versionEl.textContent = payload.version;
  });
}

closeBtn.addEventListener("click", () => window.aboutApi?.close?.());
githubBtn.addEventListener("click", () => window.aboutApi?.openGithub?.());
siteBtn.addEventListener("click", () => window.aboutApi?.openWebsite?.());
timelineBtn.addEventListener("click", () => window.aboutApi?.openTimeline?.());
