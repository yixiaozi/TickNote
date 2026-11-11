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

function mcpSnippet(token) {
  const url = `${location.origin}/mcp`;
  const auth = token || "<你的 MCP 令牌>";
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
    ? "已启用长期 MCP 令牌（令牌本身仅在生成时显示一次）"
    : "尚未生成长期令牌";
  mcpConfig.textContent = mcpSnippet(latestMcpToken || (user.hasMcpToken ? undefined : ""));
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
    mcpTokenOnce.textContent = `新令牌（请立即复制保存）：${latestMcpToken}`;
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
    mcpTokenOnce.textContent = "配置已复制到剪贴板";
    mcpTokenOnce.classList.remove("hidden");
  } catch {
    saveError.textContent = "复制失败，请手动选择文本";
    saveError.classList.remove("hidden");
  }
});

bootstrap();
