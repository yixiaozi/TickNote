const welcome = document.getElementById("welcome");
const summaryCards = document.getElementById("summaryCards");
const dayChart = document.getElementById("dayChart");
const hourChart = document.getElementById("hourChart");
const deviceChart = document.getElementById("deviceChart");
const sessionList = document.getElementById("sessionList");
const sessionCount = document.getElementById("sessionCount");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const publicLink = document.getElementById("publicLink");

wireLogout(logoutBtn);

let lastMe = null;
let lastSummary = null;
let lastSessions = null;

async function loadDashboard() {
  const me = await requireAuthOrRedirect();
  if (!me) return;
  lastMe = me;

  welcome.textContent = t("app.welcome", {
    name: me.displayName || me.username,
  });
  if (me.isPublic) {
    publicLink.href = me.publicUrl;
    publicLink.classList.remove("hidden");
  } else {
    publicLink.classList.add("hidden");
  }

  const [summary, sessionsPayload] = await Promise.all([
    api("/api/stats/summary"),
    api("/api/sessions"),
  ]);
  lastSummary = summary;
  lastSessions = sessionsPayload.sessions || [];

  renderSummaryCards(summaryCards, summary);
  renderBars(dayChart, summary.days.slice(-21).reverse(), "date", "minutes");
  renderBars(
    hourChart,
    summary.hours.filter((h) => h.minutes > 0),
    "hour",
    "minutes"
  );
  renderBars(deviceChart, summary.devices, "device", "minutes");
  renderSessions(sessionList, lastSessions, sessionCount);
}

function rerenderCached() {
  if (window.TickNoteI18n) window.TickNoteI18n.applyI18n();
  if (lastMe) {
    welcome.textContent = t("app.welcome", {
      name: lastMe.displayName || lastMe.username,
    });
    if (lastMe.isPublic) {
      publicLink.href = lastMe.publicUrl;
      publicLink.classList.remove("hidden");
    } else {
      publicLink.classList.add("hidden");
    }
  }
  if (lastSummary) {
    renderSummaryCards(summaryCards, lastSummary);
    renderBars(
      dayChart,
      lastSummary.days.slice(-21).reverse(),
      "date",
      "minutes"
    );
    renderBars(
      hourChart,
      lastSummary.hours.filter((h) => h.minutes > 0),
      "hour",
      "minutes"
    );
    renderBars(deviceChart, lastSummary.devices, "device", "minutes");
  }
  if (lastSessions) {
    renderSessions(sessionList, lastSessions, sessionCount);
  }
}

refreshBtn.addEventListener("click", () => {
  loadDashboard().catch((err) => {
    welcome.textContent = err.message;
  });
});

window.addEventListener("ticknote:localechange", rerenderCached);

loadDashboard().catch((err) => {
  welcome.textContent = err.message;
});
