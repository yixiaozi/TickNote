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

async function loadDashboard() {
  const me = await requireAuthOrRedirect();
  if (!me) return;

  welcome.textContent = `已登录：${me.displayName || me.username}`;
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

  renderSummaryCards(summaryCards, summary);
  renderBars(dayChart, summary.days.slice(-21).reverse(), "date", "minutes");
  renderBars(
    hourChart,
    summary.hours.filter((h) => h.minutes > 0),
    "hour",
    "minutes"
  );
  renderBars(deviceChart, summary.devices, "device", "minutes");
  renderSessions(sessionList, sessionsPayload.sessions || [], sessionCount);
}

refreshBtn.addEventListener("click", () => {
  loadDashboard().catch((err) => {
    welcome.textContent = err.message;
  });
});

loadDashboard().catch((err) => {
  welcome.textContent = err.message;
});
