const authForm = document.getElementById("authForm");
const authError = document.getElementById("authError");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const authTitle = document.getElementById("authTitle");
const authSub = document.getElementById("authSub");

function preferRegister() {
  return location.hash.replace("#", "") === "register";
}

function syncModeUi() {
  if (preferRegister()) {
    authTitle.textContent = t("login.register_heading");
    authSub.textContent = t("login.register_sub");
    loginBtn.textContent = t("login.create");
    registerBtn.textContent = t("login.to_login");
  } else {
    authTitle.textContent = t("login.heading");
    authSub.textContent = t("login.sub");
    loginBtn.textContent = t("login.submit");
    registerBtn.textContent = t("login.register_btn");
  }
}

async function submitAuth(mode) {
  authError.classList.add("hidden");
  loginBtn.disabled = true;
  registerBtn.disabled = true;
  try {
    const data = await api(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value,
      }),
    });
    setToken(data.token);
    location.href = "/app";
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    registerBtn.disabled = false;
  }
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(preferRegister() ? "register" : "login");
});

registerBtn.addEventListener("click", () => {
  if (preferRegister()) {
    location.hash = "";
  } else {
    location.hash = "register";
  }
  syncModeUi();
});

window.addEventListener("hashchange", syncModeUi);
window.addEventListener("ticknote:localechange", () => {
  if (window.TickNoteI18n) window.TickNoteI18n.applyI18n();
  syncModeUi();
});

(async () => {
  if (window.TickNoteI18n) window.TickNoteI18n.applyI18n();
  syncModeUi();
  if (!getToken()) return;
  try {
    await api("/api/me");
    location.href = "/app";
  } catch {
    setToken("");
  }
})();
