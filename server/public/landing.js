async function loadMeta() {
  try {
    const meta = await api("/api/meta");
    const users = document.getElementById("metaUsers");
    const sessions = document.getElementById("metaSessions");
    const pub = document.getElementById("metaPublic");
    if (users) users.textContent = String(meta.users ?? 0);
    if (sessions) sessions.textContent = String(meta.sessions ?? 0);
    if (pub) pub.textContent = String(meta.publicUsers ?? 0);
  } catch {
    /* ignore */
  }
}

async function loadPublicUsers() {
  const box = document.getElementById("publicUsers");
  if (!box) return;
  try {
    const data = await api("/api/public-users");
    const users = data.users || [];
    if (!users.length) {
      box.innerHTML =
        `<article class="feature"><h3>还没有公开主页</h3><p>登录后到「设置」打开公开开关，你的主页会出现在这里。</p></article>`;
      return;
    }
    box.innerHTML = users
      .map((u) => {
        const title = u.publicTitle || `${u.displayName} 的时间线`;
        const bio = u.bio || "这位用户开启了公开时间线。";
        return `<a class="feature" href="${escapeHtml(u.publicUrl)}" style="color:inherit;text-decoration:none">
          <span class="tag">@${escapeHtml(u.username)}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(bio)}</p>
        </a>`;
      })
      .join("");
  } catch {
    box.innerHTML = `<article class="feature"><h3>暂时无法加载</h3><p>请稍后再试。</p></article>`;
  }
}

loadMeta();
loadPublicUsers();
