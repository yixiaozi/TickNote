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
      box.innerHTML = `<article class="feature"><h3>${escapeHtml(
        t("landing.empty_public_title")
      )}</h3><p>${escapeHtml(t("landing.empty_public_body"))}</p></article>`;
      return;
    }
    box.innerHTML = users
      .map((u) => {
        const title =
          u.publicTitle ||
          t("landing.user_timeline", { name: u.displayName });
        const bio = u.bio || t("landing.user_bio_default");
        return `<a class="feature" href="${escapeHtml(u.publicUrl)}" style="color:inherit;text-decoration:none">
          <span class="tag">@${escapeHtml(u.username)}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(bio)}</p>
        </a>`;
      })
      .join("");
  } catch {
    box.innerHTML = `<article class="feature"><h3>${escapeHtml(
      t("landing.load_error_title")
    )}</h3><p>${escapeHtml(t("landing.load_error_body"))}</p></article>`;
  }
}

function refreshLanding() {
  if (window.TickNoteI18n) {
    window.TickNoteI18n.applyI18n();
  }
  loadMeta();
  loadPublicUsers();
}

window.addEventListener("ticknote:localechange", refreshLanding);
refreshLanding();
