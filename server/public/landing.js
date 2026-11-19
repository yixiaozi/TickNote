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
      box.innerHTML = `<div class="public-item">
        <span class="tag">—</span>
        <h3>${escapeHtml(t("landing.empty_public_title"))}</h3>
        <p>${escapeHtml(t("landing.empty_public_body"))}</p>
      </div>`;
      return;
    }
    box.innerHTML = users
      .map((u) => {
        const title =
          u.publicTitle || t("landing.user_timeline", { name: u.displayName });
        const bio = u.bio || t("landing.user_bio_default");
        return `<a class="public-item" href="${escapeHtml(u.publicUrl)}">
          <span class="tag">@${escapeHtml(u.username)}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(bio)}</p>
        </a>`;
      })
      .join("");
  } catch {
    box.innerHTML = `<div class="public-item">
      <span class="tag">!</span>
      <h3>${escapeHtml(t("landing.load_error_title"))}</h3>
      <p>${escapeHtml(t("landing.load_error_body"))}</p>
    </div>`;
  }
}

function wireReveal() {
  const nodes = document.querySelectorAll(".section.reveal");
  if (!nodes.length) return;
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );
  nodes.forEach((el) => io.observe(el));
}

function refreshLanding() {
  if (window.TickNoteI18n) {
    window.TickNoteI18n.applyI18n();
  }
  loadMeta();
  loadPublicUsers();
}

window.addEventListener("ticknote:localechange", refreshLanding);
wireReveal();
refreshLanding();
