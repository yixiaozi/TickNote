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

wireLogout(logoutBtn);

function fillForm(user) {
  usernameEl.value = user.username || "";
  displayNameEl.value = user.displayName || user.username || "";
  bioEl.value = user.bio || "";
  isPublicEl.checked = Boolean(user.isPublic);
  publicTitleEl.value = user.publicTitle || "";
  const url = `${location.origin}${user.publicUrl}`;
  publicUrlEl.href = user.publicUrl;
  publicUrlEl.textContent = url;
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

bootstrap();
