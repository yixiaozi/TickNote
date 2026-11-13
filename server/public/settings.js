const form = document.getElementById("settingsForm");
const usernameEl = document.getElementById("username");
const displayNameEl = document.getElementById("displayName");
const bioEl = document.getElementById("bio");
const isPublicEl = document.getElementById("isPublic");
const publicTitleEl = document.getElementById("publicTitle");
const publicUrlEl = document.getElementById("publicUrl");
const saveError = document.getElementById("saveError");
const saveOk = document.getElementById("saveOk");
const logoutBtn = document.getElementById("logoutBtn");
const mcpEndpoint = document.getElementById("mcpEndpoint");
const mcpStatus = document.getElementById("mcpStatus");
const mcpConfig = document.getElementById("mcpConfig");
const mcpTokenOnce = document.getElementById("mcpTokenOnce");
const rotateMcpBtn = document.getElementById("rotateMcpBtn");
const revokeMcpBtn = document.getElementById("revokeMcpBtn");
const copyMcpBtn = document.getElementById("copyMcpBtn");

wireLogout(logoutBtn);

let latestMcpToken = "";
let lastUser = null;
let lastTokenOnceKey = "";

function mcpSnippet(token) {
  const url = `${location.origin}/mcp`;
  const auth = token || t("settings.mcp_token_placeholder");
  return `{
  "mcpServers": {
    "ticknote-timeline": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${auth}"
      }
    }
  }
}`;
}

function fillForm(user) {
  lastUser = user;
  usernameEl.value = user.username || "";
  displayNameEl.value = user.displayName || user.username || "";
  bioEl.value = user.bio || "";
  isPublicEl.checked = Boolean(user.isPublic);
  publicTitleEl.value = user.publicTitle || "";
  const url = `${location.origin}${user.publicUrl}`;
  publicUrlEl.href = user.publicUrl;
  publicUrlEl.textContent = url;
  mcpEndpoint.textContent = `${location.origin}/mcp`;
  mcpStatus.textContent = user.hasMcpToken
    ? t("settings.mcp_enabled")
    : t("settings.mcp_none");
  mcpConfig.textContent = mcpSnippet(
    latestMcpToken || (user.hasMcpToken ? undefined : "")
  );
  if (lastTokenOnceKey === "token" && latestMcpToken) {
    mcpTokenOnce.textContent = t("settings.mcp_token_once", {
      token: latestMcpToken,
    });
  } else if (lastTokenOnceKey === "copied") {
    mcpTokenOnce.textContent = t("settings.mcp_copied");
  }
}

async function bootstrap() {
  const me = await requireAuthOrRedirect();
  if (!me) return;
  fillForm(me);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveError.classList.add("hidden");
  saveOk.classList.add("hidden");
  try {
    const user = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        displayName: displayNameEl.value.trim(),
        bio: bioEl.value.trim(),
        isPublic: isPublicEl.checked,
        publicTitle: publicTitleEl.value.trim(),
      }),
    });
    fillForm(user);
    saveOk.classList.remove("hidden");
  } catch (err) {
    saveError.textContent = err.message;
    saveError.classList.remove("hidden");
  }
});

rotateMcpBtn.addEventListener("click", async () => {
  saveError.classList.add("hidden");
  try {
    const data = await api("/api/mcp/token", {
      method: "POST",
      body: JSON.stringify({ action: "rotate" }),
    });
    latestMcpToken = data.token || "";
    lastTokenOnceKey = "token";
    mcpTokenOnce.textContent = t("settings.mcp_token_once", {
      token: latestMcpToken,
    });
    mcpTokenOnce.classList.remove("hidden");
    fillForm({
      ...(await api("/api/settings")),
      hasMcpToken: true,
    });
  } catch (err) {
    saveError.textContent = err.message;
    saveError.classList.remove("hidden");
  }
});

revokeMcpBtn.addEventListener("click", async () => {
  saveError.classList.add("hidden");
  try {
    await api("/api/mcp/token", {
      method: "POST",
      body: JSON.stringify({ action: "revoke" }),
    });
    latestMcpToken = "";
    lastTokenOnceKey = "";
    mcpTokenOnce.classList.add("hidden");
    fillForm(await api("/api/settings"));
  } catch (err) {
    saveError.textContent = err.message;
    saveError.classList.remove("hidden");
  }
});

copyMcpBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(mcpConfig.textContent || "");
    lastTokenOnceKey = "copied";
    mcpTokenOnce.textContent = t("settings.mcp_copied");
    mcpTokenOnce.classList.remove("hidden");
  } catch {
    saveError.textContent = t("settings.mcp_copy_failed");
    saveError.classList.remove("hidden");
  }
});

window.addEventListener("ticknote:localechange", () => {
  if (window.TickNoteI18n) window.TickNoteI18n.applyI18n();
  if (lastUser) fillForm(lastUser);
});

bootstrap();
