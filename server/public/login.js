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
    authTitle.textContent = "注册";
    authSub.textContent = "创建账号后即可在桌面端登录同步，并设置公开主页。";
    loginBtn.textContent = "创建账号";
    registerBtn.textContent = "已有账号？去登录";
  } else {
    authTitle.textContent = "登录";
    authSub.textContent = "登录后可查看同步统计，并管理公开主页。";
    loginBtn.textContent = "登录";
    registerBtn.textContent = "注册账号";
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

(async () => {
  syncModeUi();
  if (!getToken()) return;
  try {
    await api("/api/me");
    location.href = "/app";
  } catch {
    setToken("");
  }
})();
