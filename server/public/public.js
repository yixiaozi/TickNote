const profileCard = document.getElementById("profileCard");
const summaryCards = document.getElementById("summaryCards");
const dayChart = document.getElementById("dayChart");
const hourChart = document.getElementById("hourChart");
const deviceChart = document.getElementById("deviceChart");
const sessionList = document.getElementById("sessionList");
const sessionCount = document.getElementById("sessionCount");

let lastPayload = null;
let lastError = null;
let notFound = false;

function usernameFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[1] === "public") return decodeURIComponent(parts[0]);
  return "";
}

function renderProfile(data) {
  const profile = data.profile;
  const summary = data.summary;
  document.title = `${profile.publicTitle || profile.displayName} · TickNote`;

  profileCard.innerHTML = `
    <div class="chip-list">
      <span class="chip">@${escapeHtml(profile.username)}</span>
      <span class="chip">${escapeHtml(t("public.chip"))}</span>
    </div>
    <h1>${escapeHtml(
      profile.publicTitle ||
        t("public.default_title", { name: profile.displayName })
    )}</h1>
    <p class="sub">${escapeHtml(profile.bio || t("public.default_bio"))}</p>
  `;

  renderSummaryCards(summaryCards, summary);
  renderBars(dayChart, (summary.days || []).slice(-14).reverse(), "date", "minutes");
  renderBars(
    hourChart,
    (summary.hours || []).filter((h) => h.minutes > 0),
    "hour",
    "minutes"
  );
  renderBars(deviceChart, summary.devices || [], "device", "minutes");
  renderSessions(sessionList, data.sessions || [], sessionCount);
}

function renderError(err) {
  profileCard.innerHTML = `
    <h1>${escapeHtml(t("public.error_title"))}</h1>
    <p class="muted">${escapeHtml(err.message)}</p>
    <p><a href="/">${escapeHtml(t("public.back_home"))}</a></p>
  `;
}

function renderNotFound() {
  profileCard.innerHTML = `<h1>${escapeHtml(
    t("public.not_found_title")
  )}</h1><p class="muted">${escapeHtml(t("public.not_found_body"))}</p>`;
}

async function loadPublic() {
  const username = usernameFromPath();
  if (!username) {
    notFound = true;
    renderNotFound();
    return;
  }

  try {
    const data = await api(`/api/public/${encodeURIComponent(username)}`);
    lastPayload = data;
    lastError = null;
    notFound = false;
    renderProfile(data);
  } catch (err) {
    lastError = err;
    lastPayload = null;
    renderError(err);
  }
}

function rerender() {
  if (window.TickNoteI18n) window.TickNoteI18n.applyI18n();
  if (notFound) {
    renderNotFound();
    return;
  }
  if (lastPayload) {
    renderProfile(lastPayload);
    return;
  }
  if (lastError) {
    renderError(lastError);
  }
}

window.addEventListener("ticknote:localechange", rerender);
loadPublic();
