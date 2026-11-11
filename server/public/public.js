const profileCard = document.getElementById("profileCard");
const summaryCards = document.getElementById("summaryCards");
const dayChart = document.getElementById("dayChart");
const hourChart = document.getElementById("hourChart");
const deviceChart = document.getElementById("deviceChart");
const sessionList = document.getElementById("sessionList");
const sessionCount = document.getElementById("sessionCount");

function usernameFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[1] === "public") return decodeURIComponent(parts[0]);
  return "";
}

async function loadPublic() {
  const username = usernameFromPath();
  if (!username) {
    profileCard.innerHTML = `<h1>页面不存在</h1><p class="muted">公开地址格式为 /用户名/public</p>`;
    return;
  }

  try {
    const data = await api(`/api/public/${encodeURIComponent(username)}`);
    const profile = data.profile;
    const summary = data.summary;
    document.title = `${profile.publicTitle || profile.displayName} · TickNote`;

    profileCard.innerHTML = `
      <div class="chip-list">
        <span class="chip">@${escapeHtml(profile.username)}</span>
        <span class="chip">公开时间线</span>
      </div>
      <h1>${escapeHtml(profile.publicTitle || `${profile.displayName} 的时间线`)}</h1>
      <p class="sub">${escapeHtml(profile.bio || "这位用户分享了自己的时间记录。")}</p>
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
  } catch (err) {
    profileCard.innerHTML = `
      <h1>无法打开公开主页</h1>
      <p class="muted">${escapeHtml(err.message)}</p>
      <p><a href="/">返回首页</a></p>
    `;
  }
}

loadPublic();
