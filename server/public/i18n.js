(function (global) {
  const LOCALE_KEY = "ticknote_locale";
  const SUPPORTED = ["en", "zh"];

  const dictionaries = {
    en: {
      // Common
      "brand.name": "TickNote Timeline",
      "nav.features": "Features",
      "nav.how": "How it works",
      "nav.public": "Public pages",
      "nav.login": "Log in",
      "nav.register": "Sign up free",
      "nav.home": "Home",
      "nav.app": "Dashboard",
      "nav.settings": "Settings",
      "nav.logout": "Log out",
      "nav.my_public": "My public page",
      "nav.learn": "About TickNote",
      "nav.home_intro": "Overview",
      "lang.label": "Language",
      "lang.en": "English",
      "lang.zh": "中文",

      // Duration / shared UI
      "duration.minutes": "{n} min",
      "duration.hours": "{h} h",
      "duration.hours_minutes": "{h} h {m} min",
      "common.no_data": "No data yet",
      "common.no_sessions": "No sessions yet",
      "common.unnamed": "Untitled",
      "common.unknown_device": "Unknown device",
      "common.sessions_count": "{n} sessions",
      "common.dash": "—",

      // Summary cards
      "summary.total_time": "Total time",
      "summary.sessions": "Sessions",
      "summary.active_days": "Active days",
      "summary.avg_session": "Avg per session",

      // API errors
      "api.not_logged_in": "Not logged in",
      "api.session_expired": "Session expired",
      "api.username_invalid":
        "Username must be 2–32 characters (letters, numbers, Chinese, . _ -)",
      "api.password_invalid": "Password must be 6–72 characters",
      "api.username_taken": "Username is already taken",
      "api.bad_credentials": "Incorrect username or password",
      "api.public_not_found": "Public page not found or not enabled",
      "api.server_error": "Server error",
      "api.request_failed": "Request failed ({status})",

      // Landing
      "landing.title": "TickNote Timeline — Capture every minute",
      "landing.description":
        "TickNote is a lightweight desktop time tracker: 1-minute loop countdown, quick notes, cross-device sync, and optional public timeline pages.",
      "landing.hero_title": "A light countdown that<br />turns spare minutes into notes",
      "landing.hero_body":
        "TickNote runs quietly in a desktop corner with a 1-minute loop. Jot a note, review your day, sync across machines, or share a public stats page with colleagues and friends.",
      "landing.cta_start": "Get started",
      "landing.cta_app": "Open dashboard",
      "landing.cta_features": "See features",
      "landing.meta_users": "registered users",
      "landing.meta_sessions": "synced sessions",
      "landing.meta_public": "public pages",
      "landing.preview_title": "Time stats · 2 PM",
      "landing.preview_controls": "Min Pin Lock Top",
      "landing.preview_row1_note": "Fixed a few UI issues",
      "landing.preview_row2_note": "Reviewed next week’s report",
      "landing.preview_row3_note": "Synced to Timeline cloud",
      "landing.preview_mins": "{n} min",
      "landing.preview_mins_8_8": "8.8 min",
      "landing.preview_mins_4_5": "4.5 min",
      "landing.preview_mins_6_4": "6.4 min",
      "landing.preview_hint":
        "Desktop records time; the website handles sync, stats, and public pages.",
      "landing.features_title": "Built for quick notes",
      "landing.features_sub": "Stays out of your way, but ready when you need it.",
      "landing.tag_desktop": "Desktop",
      "landing.tag_stats": "Stats",
      "landing.tag_sync": "Sync",
      "landing.tag_public": "Public",
      "landing.tag_portable": "Portable",
      "landing.tag_web": "Web",
      "landing.tag_mcp": "MCP",
      "landing.f1_title": "1-minute loop countdown",
      "landing.f1_body":
        "One round per minute—great for Pomodoro variants, short focus, or simply asking “what am I doing this minute?”",
      "landing.f2_title": "Hourly timeline view",
      "landing.f2_body":
        "Fill or skip blank slots; mini mode, always-on-top, lock, and opacity controls included.",
      "landing.f3_title": "Two-way multi-device merge",
      "landing.f3_body":
        "Work PC and laptop each keep notes; sign in once and they pull then push, merging by update time.",
      "landing.f4_title": "Optional public page",
      "landing.f4_body":
        "When enabled, visit <code>/username/public</code> to see the stats and recent sessions you choose to share.",
      "landing.f5_title": "Choose your data folder",
      "landing.f5_body":
        "Pick a data directory on first launch, or use a portable install to carry settings between machines.",
      "landing.f6_title": "Dashboard & settings",
      "landing.f6_body":
        "Review charts and device breakdowns on the web, and set display name, bio, and public-page visibility.",
      "landing.f7_title": "Timeline API for AI",
      "landing.f7_body":
        "Create a token in Settings, then connect <code>/mcp</code> to Cursor and similar clients to query stats and notes.",
      "landing.how_title": "Three steps to start",
      "landing.how_sub": "After signing up, enter the sync URL in the desktop app.",
      "landing.step1_title": "1. Create an account",
      "landing.step1_body":
        "Sign up free here—your username also becomes your public page path.",
      "landing.step2_title": "2. Sign in on desktop",
      "landing.step2_body":
        "Open TickNote → Settings → Sync, enter the server URL, and log in with the same account.",
      "landing.step3_title": "3. Go public when ready",
      "landing.step3_body":
        "In website Settings, turn on the public switch and share <code>/your-username/public</code>.",
      "landing.public_title": "Public page examples",
      "landing.public_sub":
        "Users who enabled sharing appear here (off by default—privacy first).",
      "landing.public_cta": "Open public settings",
      "landing.footer_tagline": "TickNote Timeline · Time tracking & sync",
      "landing.empty_public_title": "No public pages yet",
      "landing.empty_public_body":
        "Sign in, open Settings, and turn on the public switch—your page will show up here.",
      "landing.user_timeline": "{name}'s timeline",
      "landing.user_bio_default": "This user enabled a public timeline.",
      "landing.load_error_title": "Could not load",
      "landing.load_error_body": "Please try again later.",

      // Login
      "login.title": "Log in · TickNote Timeline",
      "login.heading": "Log in",
      "login.sub": "Sign in to view sync stats and manage your public page.",
      "login.register_heading": "Sign up",
      "login.register_sub":
        "Create an account to sync from desktop and set up a public page.",
      "login.username": "Username",
      "login.password": "Password",
      "login.submit": "Log in",
      "login.create": "Create account",
      "login.register_btn": "Create an account",
      "login.to_login": "Already have an account? Log in",
      "login.hint":
        "Desktop sync URL:",

      // App / dashboard
      "app.title": "Dashboard · TickNote Timeline",
      "app.heading": "Dashboard",
      "app.refresh": "Refresh",
      "app.account_settings": "Account settings",
      "app.days_title": "By day (recent)",
      "app.hours_title": "Distribution by hour",
      "app.devices_title": "Devices",
      "app.recent_title": "Recent sessions",
      "app.welcome": "Signed in as {name}",

      // Settings
      "settings.title": "Settings · TickNote Timeline",
      "settings.heading": "Account settings",
      "settings.sub":
        "Manage your profile and whether your timeline page is public.",
      "settings.language_section": "Language",
      "settings.language_hint": "Applies to the website UI. Saved in this browser.",
      "settings.profile": "Profile",
      "settings.username": "Username",
      "settings.display_name": "Display name",
      "settings.display_name_ph": "e.g. Alex",
      "settings.bio": "Bio",
      "settings.bio_ph": "One line about what you track",
      "settings.public_section": "Public page",
      "settings.public_toggle": "Make my page public",
      "settings.public_toggle_hint":
        "When on, anyone can view your stats and recent sessions via the link below.",
      "settings.public_toggle_title": "Public visibility",
      "settings.public_title_label": "Public page title",
      "settings.public_title_ph": "e.g. Alex’s work timeline",
      "settings.public_url": "Public URL:",
      "settings.mcp_section": "MCP access",
      "settings.mcp_hint":
        "For Cursor and other AI clients to read your timeline. Endpoint:",
      "settings.mcp_none": "No long-lived token yet",
      "settings.mcp_enabled":
        "Long-lived MCP token enabled (shown only once when created)",
      "settings.mcp_rotate": "Generate / rotate token",
      "settings.mcp_revoke": "Revoke token",
      "settings.mcp_copy": "Copy config",
      "settings.mcp_token_once": "New token (copy and save now): {token}",
      "settings.mcp_copied": "Config copied to clipboard",
      "settings.mcp_copy_failed": "Copy failed—please select the text manually",
      "settings.mcp_token_placeholder": "<your MCP token>",
      "settings.saved": "Saved",
      "settings.save": "Save settings",
      "settings.back": "Back to dashboard",

      // Public page
      "public.title": "Public timeline · TickNote Timeline",
      "public.loading": "Loading public page…",
      "public.days_title": "Recent days",
      "public.hours_title": "Hourly distribution",
      "public.devices_title": "Devices",
      "public.recent_title": "Recent sessions",
      "public.chip": "Public timeline",
      "public.default_title": "{name}'s timeline",
      "public.default_bio": "This user shared their time records.",
      "public.not_found_title": "Page not found",
      "public.not_found_body": "Public URLs look like /username/public",
      "public.error_title": "Unable to open public page",
      "public.back_home": "Back to home",
    },
    zh: {
      "brand.name": "TickNote Timeline",
      "nav.features": "功能",
      "nav.how": "怎么用",
      "nav.public": "公开主页",
      "nav.login": "登录",
      "nav.register": "免费注册",
      "nav.home": "首页",
      "nav.app": "控制台",
      "nav.settings": "设置",
      "nav.logout": "退出",
      "nav.my_public": "我的公开页",
      "nav.learn": "了解 TickNote",
      "nav.home_intro": "首页介绍",
      "lang.label": "语言",
      "lang.en": "English",
      "lang.zh": "中文",

      "duration.minutes": "{n}分",
      "duration.hours": "{h}小时",
      "duration.hours_minutes": "{h}小时{m}分",
      "common.no_data": "暂无数据",
      "common.no_sessions": "暂无记录",
      "common.unnamed": "未命名",
      "common.unknown_device": "未知设备",
      "common.sessions_count": "{n} 条",
      "common.dash": "—",

      "summary.total_time": "总时长",
      "summary.sessions": "记录数",
      "summary.active_days": "活跃天数",
      "summary.avg_session": "平均每条",

      "api.not_logged_in": "未登录",
      "api.session_expired": "登录已失效",
      "api.username_invalid": "用户名需 2-32 位（字母/数字/中文/._-）",
      "api.password_invalid": "密码需 6-72 位",
      "api.username_taken": "用户名已被占用",
      "api.bad_credentials": "用户名或密码错误",
      "api.public_not_found": "公开主页不存在或未开启",
      "api.server_error": "服务器错误",
      "api.request_failed": "请求失败 ({status})",

      "landing.title": "TickNote Timeline — 把每一分钟记下来",
      "landing.description":
        "TickNote 是轻量桌面时间记录工具：1 分钟循环倒计时、随手笔记、跨设备同步，并支持公开时间线主页。",
      "landing.hero_title": "轻量倒计时，<br />把碎片时间收成记录",
      "landing.hero_body":
        "TickNote 在桌面角落安静跑着 1 分钟循环。写一句备注、看一天分布、多台电脑同步，也可以把统计页公开给同事或朋友。",
      "landing.cta_start": "开始使用",
      "landing.cta_app": "打开控制台",
      "landing.cta_features": "了解功能",
      "landing.meta_users": "注册用户",
      "landing.meta_sessions": "同步记录",
      "landing.meta_public": "公开主页",
      "landing.preview_title": "时间统计 · 14 点",
      "landing.preview_controls": "迷 机 固 顶",
      "landing.preview_row1_note": "又挑了几个界面问题",
      "landing.preview_row2_note": "看了下周报表和进度表",
      "landing.preview_row3_note": "同步到 Timeline 云端",
      "landing.preview_mins": "{n}分",
      "landing.preview_mins_8_8": "8.8分",
      "landing.preview_mins_4_5": "4.5分",
      "landing.preview_mins_6_4": "6.4分",
      "landing.preview_hint":
        "桌面端负责记录，网站负责同步、统计与公开主页。",
      "landing.features_title": "为「随手记」做的功能",
      "landing.features_sub": "不打扰工作流，但关键时够用。",
      "landing.tag_desktop": "桌面端",
      "landing.tag_stats": "统计",
      "landing.tag_sync": "同步",
      "landing.tag_public": "公开",
      "landing.tag_portable": "便携",
      "landing.tag_web": "网页",
      "landing.tag_mcp": "MCP",
      "landing.f1_title": "1 分钟循环倒计时",
      "landing.f1_body":
        "每分钟一轮，适合番茄变体、短时专注，或只是提醒自己「这一分钟在做什么」。",
      "landing.f2_title": "按小时查看时间线",
      "landing.f2_body":
        "空白时段可补记或忽略；支持迷你模式、置顶、锁定与透明度调节。",
      "landing.f3_title": "多设备双向合并",
      "landing.f3_body":
        "公司电脑与笔记本各自写备注，登录同一账号后自动拉取再推送，冲突按更新时间合并。",
      "landing.f4_title": "可选公开主页",
      "landing.f4_body":
        "开启后，访问 <code>/用户名/public</code> 即可查看你愿意公开的统计与近期记录。",
      "landing.f5_title": "数据目录自选",
      "landing.f5_body":
        "首次启动可选数据文件夹，也支持便携安装，方便在多台机器间带走配置。",
      "landing.f6_title": "控制台与设置",
      "landing.f6_body":
        "网站可看总览图表、设备分布，并设置展示名、简介与是否公开主页。",
      "landing.f7_title": "给 AI 用的时间线接口",
      "landing.f7_body":
        "在设置里生成令牌后，可把 <code>/mcp</code> 接到 Cursor 等客户端，查询统计与备注。",
      "landing.how_title": "三步开始",
      "landing.how_sub": "注册账号后，桌面端填入同步地址即可。",
      "landing.step1_title": "1. 注册账号",
      "landing.step1_body":
        "在本站免费注册，用户名稍后也会用于公开主页地址。",
      "landing.step2_title": "2. 桌面端登录",
      "landing.step2_body":
        "打开 TickNote → 设置 → 同步，填写服务器地址并登录同一账号。",
      "landing.step3_title": "3. 需要时公开",
      "landing.step3_body":
        "在网站「设置」打开公开开关，分享 <code>/你的用户名/public</code>。",
      "landing.public_title": "公开主页示例",
      "landing.public_sub":
        "已开启公开的用户会出现在这里（默认关闭，隐私优先）。",
      "landing.public_cta": "去设置公开",
      "landing.footer_tagline": "TickNote Timeline · 时间记录与同步",
      "landing.empty_public_title": "还没有公开主页",
      "landing.empty_public_body":
        "登录后到「设置」打开公开开关，你的主页会出现在这里。",
      "landing.user_timeline": "{name} 的时间线",
      "landing.user_bio_default": "这位用户开启了公开时间线。",
      "landing.load_error_title": "暂时无法加载",
      "landing.load_error_body": "请稍后再试。",

      "login.title": "登录 · TickNote Timeline",
      "login.heading": "登录",
      "login.sub": "登录后可查看同步统计，并管理公开主页。",
      "login.register_heading": "注册",
      "login.register_sub":
        "创建账号后即可在桌面端登录同步，并设置公开主页。",
      "login.username": "用户名",
      "login.password": "密码",
      "login.submit": "登录",
      "login.create": "创建账号",
      "login.register_btn": "注册账号",
      "login.to_login": "已有账号？去登录",
      "login.hint": "桌面端同步地址请填写：",

      "app.title": "控制台 · TickNote Timeline",
      "app.heading": "控制台",
      "app.refresh": "刷新",
      "app.account_settings": "账号设置",
      "app.days_title": "按天（最近）",
      "app.hours_title": "一天中的分布（小时）",
      "app.devices_title": "设备",
      "app.recent_title": "最近记录",
      "app.welcome": "已登录：{name}",

      "settings.title": "设置 · TickNote Timeline",
      "settings.heading": "账号设置",
      "settings.sub": "管理展示信息，以及是否公开你的时间线主页。",
      "settings.language_section": "语言",
      "settings.language_hint": "应用于网站界面，保存在本浏览器。",
      "settings.profile": "基本资料",
      "settings.username": "用户名",
      "settings.display_name": "显示名称",
      "settings.display_name_ph": "例如：小王",
      "settings.bio": "简介",
      "settings.bio_ph": "一句话介绍你在记什么时间",
      "settings.public_section": "公开主页",
      "settings.public_toggle": "公开我的主页",
      "settings.public_toggle_hint":
        "开启后，任何人可通过下方链接查看统计与近期记录。",
      "settings.public_toggle_title": "是否公开",
      "settings.public_title_label": "公开页标题",
      "settings.public_title_ph": "例如：小王的工作时间线",
      "settings.public_url": "公开地址：",
      "settings.mcp_section": "MCP 接入",
      "settings.mcp_hint": "供 Cursor 等 AI 客户端读取你的时间线。端点：",
      "settings.mcp_none": "尚未生成长期令牌",
      "settings.mcp_enabled":
        "已启用长期 MCP 令牌（令牌本身仅在生成时显示一次）",
      "settings.mcp_rotate": "生成 / 轮换令牌",
      "settings.mcp_revoke": "作废令牌",
      "settings.mcp_copy": "复制配置",
      "settings.mcp_token_once": "新令牌（请立即复制保存）：{token}",
      "settings.mcp_copied": "配置已复制到剪贴板",
      "settings.mcp_copy_failed": "复制失败，请手动选择文本",
      "settings.mcp_token_placeholder": "<你的 MCP 令牌>",
      "settings.saved": "已保存",
      "settings.save": "保存设置",
      "settings.back": "返回控制台",

      "public.title": "公开时间线 · TickNote Timeline",
      "public.loading": "正在加载公开主页…",
      "public.days_title": "最近按天",
      "public.hours_title": "小时分布",
      "public.devices_title": "设备",
      "public.recent_title": "近期记录",
      "public.chip": "公开时间线",
      "public.default_title": "{name} 的时间线",
      "public.default_bio": "这位用户分享了自己的时间记录。",
      "public.not_found_title": "页面不存在",
      "public.not_found_body": "公开地址格式为 /用户名/public",
      "public.error_title": "无法打开公开主页",
      "public.back_home": "返回首页",
    },
  };

  function normalizeLocale(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("en")) return "en";
    return SUPPORTED.includes(raw) ? raw : "en";
  }

  function getLocale() {
    try {
      return normalizeLocale(localStorage.getItem(LOCALE_KEY) || "en");
    } catch {
      return "en";
    }
  }

  function setLocale(locale) {
    const next = normalizeLocale(locale);
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    }
    return next;
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, (_, key) =>
      vars[key] == null ? "" : String(vars[key])
    );
  }

  function t(key, vars) {
    const locale = getLocale();
    const dict = dictionaries[locale] || dictionaries.en;
    const fallback = dictionaries.en;
    const template = dict[key] ?? fallback[key] ?? key;
    return interpolate(template, vars);
  }

  function applyAttr(el, attrName, key) {
    if (!key) return;
    const value = t(key);
    if (attrName === "text") {
      el.textContent = value;
      return;
    }
    if (attrName === "html") {
      el.innerHTML = value;
      return;
    }
    el.setAttribute(attrName, value);
  }

  function applyI18n(root) {
    const scope =
      root && typeof root.querySelectorAll === "function" ? root : document;

    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      if (el.tagName === "META") {
        el.setAttribute("content", t(key));
      } else if (el.tagName === "TITLE") {
        el.textContent = t(key);
        if (el.ownerDocument) el.ownerDocument.title = t(key);
      } else {
        el.textContent = t(key);
      }
    });

    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      applyAttr(el, "html", el.getAttribute("data-i18n-html"));
    });

    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      applyAttr(el, "title", el.getAttribute("data-i18n-title"));
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      applyAttr(el, "placeholder", el.getAttribute("data-i18n-placeholder"));
    });

    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      applyAttr(el, "aria-label", el.getAttribute("data-i18n-aria"));
    });

    scope.querySelectorAll("[data-locale-select]").forEach((el) => {
      if (el.tagName === "SELECT") el.value = getLocale();
    });
  }

  function wireLocaleControls(root) {
    const scope =
      root && typeof root.querySelectorAll === "function" ? root : document;
    scope.querySelectorAll("[data-locale-select]").forEach((el) => {
      if (el.dataset.i18nBound) return;
      el.dataset.i18nBound = "1";
      el.value = getLocale();
      el.addEventListener("change", () => {
        setLocale(el.value);
        applyI18n();
        global.dispatchEvent(
          new CustomEvent("ticknote:localechange", {
            detail: { locale: getLocale() },
          })
        );
      });
    });
  }

  // Initialize default storage + html lang
  setLocale(getLocale());

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        applyI18n();
        wireLocaleControls();
      });
    } else {
      applyI18n();
      wireLocaleControls();
    }
  }

  global.TickNoteI18n = {
    LOCALE_KEY,
    dictionaries,
    getLocale,
    setLocale,
    t,
    applyI18n,
    wireLocaleControls,
  };
})(typeof window !== "undefined" ? window : globalThis);
