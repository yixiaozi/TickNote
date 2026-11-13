(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root !== "undefined") {
    root.TickNoteI18n = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SUPPORTED = ["en", "zh"];
  let currentLocale = "en";

  const dictionaries = {
    en: {
      "lang.en": "English",
      "lang.zh": "中文",
      "lang.label": "Language",
      "lang.hint": "Applies to the whole app. Default is English.",

      "common.close": "Close",
      "common.cancel": "Cancel",
      "common.ok": "OK",
      "common.save": "Save",
      "common.unnamed": "Untitled",
      "common.unknown_device": "Unknown device",
      "common.local_machine": "This PC",
      "common.dash": "—",

      "duration.minutes": "{n} min",
      "duration.hours": "{h} h",
      "duration.hours_minutes": "{h} h {m} min",

      "main.tick_on": "Tick sound: on",
      "main.tick_off": "Tick sound: off",
      "main.tick_toggle": "Toggle tick sound",
      "main.stats": "Open stats",
      "main.drag": "Drag to move",
      "main.reset": "Reset and save to stats",
      "main.loop_prefix": "R",
      "main.loop_suffix": "",
      "main.note_placeholder": "What are you doing… (time note)",
      "main.note_title": "Enter ends this round; Ctrl+Enter for newline",
      "main.tray_label": "{time} · R{loops}",

      "stats.title": "TickNote Stats",
      "stats.heading": "Time stats",
      "stats.sessions_suffix": " sessions",
      "stats.mini": "Mini mode: last 5",
      "stats.mini_exit": "Exit mini mode",
      "stats.search": "Search history",
      "stats.search_close": "Close search",
      "stats.search_placeholder": "All words required; -word excludes…",
      "stats.device_show": "Show machine name",
      "stats.device_hide": "Hide machine name",
      "stats.lock": "Pin position",
      "stats.unlock": "Unpin position",
      "stats.top": "Always on top",
      "stats.top_off": "Disable always on top",
      "stats.opacity": "Opacity {n}%",
      "stats.home": "Jump to now",
      "stats.prev_day": "Previous day with data",
      "stats.next_day": "Next day with data",
      "stats.pick_date": "Pick a date with data",
      "stats.pick_date_aria": "Choose date",
      "stats.all_day": "Show all records for the day",
      "stats.all_day_aria": "All day",
      "stats.empty_day": "No records for this day.",
      "stats.empty_hour": "Pick an hour that has data.",
      "stats.empty_mini": "No records yet.",
      "stats.empty_search_hint": "Type keywords to search history",
      "stats.empty_search": "No matching records",
      "stats.gap_placeholder": "Idle time (edit or remove)",
      "stats.gap_note": "Idle time",
      "stats.gap_save": "Save as record",
      "stats.gap_dismiss": "Remove idle gap",
      "stats.note_edit_title": "Enter to save; Ctrl+Enter for newline",
      "stats.weekday.0": "Su",
      "stats.weekday.1": "Mo",
      "stats.weekday.2": "Tu",
      "stats.weekday.3": "We",
      "stats.weekday.4": "Th",
      "stats.weekday.5": "Fr",
      "stats.weekday.6": "Sa",
      "stats.month_label": "{y}-{m}",

      "settings.title": "TickNote Settings",
      "settings.heading": "Settings",
      "settings.subtitle": "Sync, this PC, and MCP",
      "settings.tab.sync": "Sync",
      "settings.tab.local": "This PC",
      "settings.tab.mcp": "MCP",
      "settings.account_status": "Account",
      "settings.account_desc": "Sign in to sync notes across computers",
      "settings.logged_out": "Not signed in",
      "settings.logged_in": "Signed in",
      "settings.account": "Account",
      "settings.last_sync": "Last sync",
      "settings.sync_site": "Sync site",
      "settings.sync_site_desc": "Official site by default, or your own Timeline",
      "settings.site_url": "Website URL",
      "settings.site_hint": "Takes effect after save",
      "settings.login": "Log in",
      "settings.register": "Sign up",
      "settings.logout": "Log out",
      "settings.sync_now": "Sync now",
      "settings.machine": "Machine ID",
      "settings.machine_desc": "Tells which computer wrote a note",
      "settings.machine_name": "Machine name",
      "settings.machine_hint":
        "Saved as “Name · TickNote”, and updates local history",
      "settings.data_dir": "Data folder",
      "settings.data_dir_desc": "Sessions, settings, and drafts live here",
      "settings.current_path": "Current path",
      "settings.change_dir": "Change folder…",
      "settings.open_dir": "Open folder",
      "settings.mcp_title": "Local MCP",
      "settings.mcp_desc": "Let Cursor and other clients read local notes",
      "settings.mcp_off": "Off",
      "settings.mcp_on": "Running",
      "settings.mcp_error": "Error",
      "settings.mcp_enable": "Enable local MCP server",
      "settings.mcp_bind_hint": "Listens on 127.0.0.1 only",
      "settings.port": "Port",
      "settings.status": "Status",
      "settings.address": "Address",
      "settings.not_running": "Not running",
      "settings.not_running_err": "Not running ({err})",
      "settings.mcp_toggle_hint":
        "The switch applies immediately — no need to click Save.",
      "settings.token_title": "Access token",
      "settings.token_desc": "Recommended. Use Authorization: Bearer in config",
      "settings.token_none": "No token yet (create one before enabling)",
      "settings.token_on": "Token enabled{preview}",
      "settings.token_rotate": "Create / rotate token",
      "settings.token_revoke": "Revoke token",
      "settings.token_copy": "Copy config",
      "settings.save": "Save settings",
      "settings.saved": "Saved",
      "settings.login_ok": "Signed in",
      "settings.register_ok": "Account created",
      "settings.logout_ok": "Signed out",
      "settings.sync_ok": "Sync complete",
      "settings.mcp_started": "MCP started",
      "settings.mcp_enabled_stopped": "Enabled but not running",
      "settings.mcp_stopped": "MCP stopped",
      "settings.mcp_start_fail": "Failed to start: {err}",
      "settings.token_new": "New token (copy now): {token}",
      "settings.token_updated": "Token updated",
      "settings.token_revoked": "Token revoked",
      "settings.copied": "Config copied",
      "settings.copy_fail": "Copy failed — select the text manually",
      "settings.mcp_token_placeholder": "<your MCP token>",
      "settings.last_sync_never": "Never synced",
      "settings.last_sync_prefix": "Last sync: ",

      "about.title": "About TickNote",
      "about.tag": "Tick notes · one-minute time blocks",
      "about.desc":
        "A light countdown that slices time into reviewable blocks. Note what you did, sync across PCs, and dig into stats on Timeline.",
      "about.version": "Version",
      "about.sync_site": "Sync site",
      "about.site": "Website",

      "tray.show": "Show window",
      "tray.hide": "Hide window",
      "tray.tick": "Tick every second",
      "tray.stats": "Open stats",
      "tray.settings": "Settings…",
      "tray.reset": "Reset round & timer",
      "tray.account_user": "Account: {name}",
      "tray.account_none": "Account: not signed in",
      "tray.sync_now": "Sync now",
      "tray.open_site": "Open sync website",
      "tray.about": "About TickNote",
      "tray.quit": "Quit",

      "dialog.data_first_title": "Choose data folder",
      "dialog.data_first_msg": "First launch — choose where TickNote stores data",
      "dialog.data_first_detail":
        "Stats, settings, and drafts are saved here.\nYou can change this later from the tray menu.",
      "dialog.data_pick": "Choose folder",
      "dialog.data_default": "Use default",
      "dialog.data_cancel": "Cancel",
      "dialog.data_folder_title": "Choose TickNote data folder",
      "dialog.data_new_title": "Choose a new data folder",
      "dialog.migrate_title": "Move data",
      "dialog.migrate_msg": "Copy existing data to the new location?",
      "dialog.migrate_detail": "Current: {current}\nNew: {next}",
      "dialog.migrate_copy": "Copy and switch",
      "dialog.migrate_switch": "Switch only (no copy)",
      "dialog.updated_title": "Updated",
      "dialog.updated_msg": "Data folder changed",
      "dialog.machine_title": "Set machine name",
      "dialog.machine_msg":
        "Used to tell which computer wrote a note (saved as “Name · TickNote”)",
      "dialog.auth_register": "Sign up for TickNote",
      "dialog.auth_login": "Sign in to TickNote",
      "dialog.auth_register_btn": "Sign up",
      "dialog.auth_login_btn": "Log in",
      "dialog.auth_username": "Username",
      "dialog.auth_password": "Password",
      "dialog.auth_need_fields": "Enter a username; password must be at least 6 characters",
      "dialog.auth_fail_register": "Sign-up failed",
      "dialog.auth_fail_login": "Sign-in failed",
      "dialog.auth_need_continue": "Cannot continue",
      "dialog.sync_need_login_title": "Not signed in",
      "dialog.sync_need_login_msg": "Sign up or log in before syncing",
      "dialog.sync_ok_title": "Sync complete",
      "dialog.sync_ok_msg":
        "Two-way sync done: pulled other devices and uploaded local notes",
      "dialog.sync_fail": "Sync failed",
      "dialog.bad_sync_url": "Sync URL must start with http:// or https://",
      "dialog.bad_sync_url_generic": "Invalid sync URL",
      "dialog.mcp_start_fail": "MCP failed to start: {err}",

      "api.not_logged_in": "Not logged in",
      "api.session_expired": "Session expired",
      "api.username_invalid":
        "Username must be 2–32 characters (letters, numbers, Chinese, . _ -)",
      "api.password_invalid": "Password must be 6–72 characters",
      "api.username_taken": "Username is already taken",
      "api.bad_credentials": "Incorrect username or password",
      "api.public_not_found": "Public page not found or not enabled",
      "api.server_error": "Server error",
    },
    zh: {
      "lang.en": "English",
      "lang.zh": "中文",
      "lang.label": "语言",
      "lang.hint": "对整个软件生效。默认英文。",

      "common.close": "关闭",
      "common.cancel": "取消",
      "common.ok": "确定",
      "common.save": "保存",
      "common.unnamed": "未命名",
      "common.unknown_device": "未知设备",
      "common.local_machine": "本机",
      "common.dash": "—",

      "duration.minutes": "{n}分",
      "duration.hours": "{h}小时",
      "duration.hours_minutes": "{h}小时{m}分",

      "main.tick_on": "滴答声：开",
      "main.tick_off": "滴答声：关",
      "main.tick_toggle": "切换滴答声",
      "main.stats": "查看统计",
      "main.drag": "拖动移动位置",
      "main.reset": "重置并记入统计",
      "main.loop_prefix": "第",
      "main.loop_suffix": "轮",
      "main.note_placeholder": "正在做什么…（时间标记）",
      "main.note_title": "回车结束本轮；Ctrl+Enter 换行",
      "main.tray_label": "{time} · 第{loops}轮",

      "stats.title": "TickNote 统计",
      "stats.heading": "时间统计",
      "stats.sessions_suffix": " 条",
      "stats.mini": "迷你模式：最近5条",
      "stats.mini_exit": "退出迷你模式",
      "stats.search": "搜索历史",
      "stats.search_close": "关闭搜索",
      "stats.search_placeholder": "多关键词=同时包含，-词=排除…",
      "stats.device_show": "显示机器名",
      "stats.device_hide": "隐藏机器名",
      "stats.lock": "固定位置",
      "stats.unlock": "取消固定位置",
      "stats.top": "窗口置顶",
      "stats.top_off": "取消置顶",
      "stats.opacity": "透明度 {n}%",
      "stats.home": "回到当前时间",
      "stats.prev_day": "前一天有数据",
      "stats.next_day": "后一天有数据",
      "stats.pick_date": "选择有数据的日期",
      "stats.pick_date_aria": "选择日期",
      "stats.all_day": "显示当天全部记录",
      "stats.all_day_aria": "全天",
      "stats.empty_day": "这一天还没有记录。",
      "stats.empty_hour": "请选择有数据的小时。",
      "stats.empty_mini": "还没有记录。",
      "stats.empty_search_hint": "输入关键词搜索历史记录",
      "stats.empty_search": "没有匹配的记录",
      "stats.gap_placeholder": "空白时间（可填写或删除）",
      "stats.gap_note": "空白时间",
      "stats.gap_save": "保存为记录",
      "stats.gap_dismiss": "删除空白",
      "stats.note_edit_title": "回车保存；Ctrl+Enter 换行",
      "stats.weekday.0": "日",
      "stats.weekday.1": "一",
      "stats.weekday.2": "二",
      "stats.weekday.3": "三",
      "stats.weekday.4": "四",
      "stats.weekday.5": "五",
      "stats.weekday.6": "六",
      "stats.month_label": "{y}年{m}月",

      "settings.title": "TickNote 设置",
      "settings.heading": "设置",
      "settings.subtitle": "同步、本机与 MCP",
      "settings.tab.sync": "同步",
      "settings.tab.local": "本机",
      "settings.tab.mcp": "MCP",
      "settings.account_status": "账号状态",
      "settings.account_desc": "登录后可在多台电脑之间双向同步记录",
      "settings.logged_out": "未登录",
      "settings.logged_in": "已登录",
      "settings.account": "账号",
      "settings.last_sync": "上次同步",
      "settings.sync_site": "同步站点",
      "settings.sync_site_desc": "默认官方站点，也可换成自己部署的 Timeline",
      "settings.site_url": "网站地址",
      "settings.site_hint": "保存后立即生效",
      "settings.login": "登录",
      "settings.register": "注册",
      "settings.logout": "退出",
      "settings.sync_now": "立即同步",
      "settings.machine": "机器标识",
      "settings.machine_desc": "用来区分哪台电脑写下的记录",
      "settings.machine_name": "机器名",
      "settings.machine_hint":
        "保存后记为「机器名 · TickNote」，并回写本机旧记录",
      "settings.data_dir": "数据目录",
      "settings.data_dir_desc": "会话、设置与草稿都存放在这里",
      "settings.current_path": "当前路径",
      "settings.change_dir": "更改目录…",
      "settings.open_dir": "打开文件夹",
      "settings.mcp_title": "本机 MCP",
      "settings.mcp_desc": "让 Cursor 等客户端直接读取本机时间记录",
      "settings.mcp_off": "已关闭",
      "settings.mcp_on": "运行中",
      "settings.mcp_error": "异常",
      "settings.mcp_enable": "启用本地 MCP 服务",
      "settings.mcp_bind_hint": "仅监听 127.0.0.1，不会对外网开放",
      "settings.port": "端口",
      "settings.status": "状态",
      "settings.address": "地址",
      "settings.not_running": "未运行",
      "settings.not_running_err": "未运行（{err}）",
      "settings.mcp_toggle_hint":
        "开关会立即生效，无需再点底部「保存设置」。",
      "settings.token_title": "访问令牌",
      "settings.token_desc": "建议开启；配置里用 Authorization: Bearer",
      "settings.token_none": "尚未生成令牌（可先生成再启用）",
      "settings.token_on": "已启用令牌{preview}",
      "settings.token_rotate": "生成 / 轮换令牌",
      "settings.token_revoke": "作废令牌",
      "settings.token_copy": "复制配置",
      "settings.save": "保存设置",
      "settings.saved": "已保存",
      "settings.login_ok": "登录成功",
      "settings.register_ok": "注册成功",
      "settings.logout_ok": "已退出登录",
      "settings.sync_ok": "同步完成",
      "settings.mcp_started": "MCP 已启动",
      "settings.mcp_enabled_stopped": "已启用但未运行",
      "settings.mcp_stopped": "MCP 已关闭",
      "settings.mcp_start_fail": "启动失败：{err}",
      "settings.token_new": "新令牌（请立即复制）：{token}",
      "settings.token_updated": "令牌已更新",
      "settings.token_revoked": "令牌已作废",
      "settings.copied": "配置已复制",
      "settings.copy_fail": "复制失败，请手动选择文本",
      "settings.mcp_token_placeholder": "<你的 MCP 令牌>",
      "settings.last_sync_never": "尚未同步",
      "settings.last_sync_prefix": "上次同步：",

      "about.title": "关于 TickNote",
      "about.tag": "滴答记 · 一分钟循环时间块",
      "about.desc":
        "用轻量倒计时把时间切成可回看的片段。记录你在做什么，同步到多台电脑，并在 Timeline 里回看更细的统计。",
      "about.version": "版本",
      "about.sync_site": "同步站",
      "about.site": "个人网站",

      "tray.show": "显示窗口",
      "tray.hide": "隐藏窗口",
      "tray.tick": "每秒滴答声",
      "tray.stats": "查看统计",
      "tray.settings": "设置…",
      "tray.reset": "重置轮次与计时",
      "tray.account_user": "账号: {name}",
      "tray.account_none": "账号: 未登录",
      "tray.sync_now": "立即同步",
      "tray.open_site": "打开同步网站",
      "tray.about": "关于 TickNote",
      "tray.quit": "退出",

      "dialog.data_first_title": "选择数据存放位置",
      "dialog.data_first_msg": "首次使用 TickNote，请选择数据存放位置",
      "dialog.data_first_detail":
        "统计记录、设置和草稿都会保存在这个文件夹。\n之后也可在托盘菜单中更改。",
      "dialog.data_pick": "选择文件夹",
      "dialog.data_default": "使用默认位置",
      "dialog.data_cancel": "取消",
      "dialog.data_folder_title": "选择 TickNote 数据文件夹",
      "dialog.data_new_title": "选择新的数据存放位置",
      "dialog.migrate_title": "迁移数据",
      "dialog.migrate_msg": "是否把现有数据复制到新位置？",
      "dialog.migrate_detail": "当前：{current}\n新位置：{next}",
      "dialog.migrate_copy": "复制并切换",
      "dialog.migrate_switch": "仅切换（不复制）",
      "dialog.updated_title": "已更新",
      "dialog.updated_msg": "数据目录已更改",
      "dialog.machine_title": "设置机器名",
      "dialog.machine_msg":
        "用于区分哪台电脑写下的记录（保存为「机器名 · TickNote」）",
      "dialog.auth_register": "注册 TickNote 账号",
      "dialog.auth_login": "登录 TickNote 账号",
      "dialog.auth_register_btn": "注册",
      "dialog.auth_login_btn": "登录",
      "dialog.auth_username": "用户名",
      "dialog.auth_password": "密码",
      "dialog.auth_need_fields": "请填写用户名，密码至少 6 位",
      "dialog.auth_fail_register": "注册失败",
      "dialog.auth_fail_login": "登录失败",
      "dialog.auth_need_continue": "无法继续",
      "dialog.sync_need_login_title": "尚未登录",
      "dialog.sync_need_login_msg": "请先注册或登录后再同步",
      "dialog.sync_ok_title": "同步完成",
      "dialog.sync_ok_msg": "已双向同步：拉取其他设备数据并上传本机记录",
      "dialog.sync_fail": "同步失败",
      "dialog.bad_sync_url": "同步地址需以 http:// 或 https:// 开头",
      "dialog.bad_sync_url_generic": "同步地址无效",
      "dialog.mcp_start_fail": "MCP 启动失败：{err}",

      "api.not_logged_in": "未登录",
      "api.session_expired": "登录已失效",
      "api.username_invalid":
        "用户名需 2-32 位（字母、数字、中文、. _ -）",
      "api.password_invalid": "密码需 6-72 位",
      "api.username_taken": "用户名已被占用",
      "api.bad_credentials": "用户名或密码错误",
      "api.public_not_found": "公开主页不存在或未开启",
      "api.server_error": "服务器错误",
    },
  };

  function normalizeLocale(locale) {
    const raw = String(locale || "en").toLowerCase();
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("en")) return "en";
    return SUPPORTED.includes(raw) ? raw : "en";
  }

  function setLocale(locale) {
    currentLocale = normalizeLocale(locale);
    return currentLocale;
  }

  function getLocale() {
    return currentLocale;
  }

  function t(key, vars) {
    const dict = dictionaries[currentLocale] || dictionaries.en;
    let text = dict[key] ?? dictionaries.en[key] ?? key;
    if (vars && typeof vars === "object") {
      text = String(text).replace(/\{(\w+)\}/g, (_, name) =>
        vars[name] == null ? "" : String(vars[name])
      );
    }
    return text;
  }

  function formatDuration(minutes) {
    const raw = Math.max(0, Number(minutes) || 0);
    const total = Math.round(raw * 10) / 10;
    if (total < 60) return t("duration.minutes", { n: total });
    const hours = Math.floor(total / 60);
    const mins = Math.round((total - hours * 60) * 10) / 10;
    if (mins <= 0) return t("duration.hours", { h: hours });
    return t("duration.hours_minutes", { h: hours, m: mins });
  }

  function applyI18n(root) {
    const scope = root || (typeof document !== "undefined" ? document : null);
    if (!scope || !scope.querySelectorAll) return;
    if (typeof document !== "undefined") {
      document.documentElement.lang = currentLocale === "zh" ? "zh-CN" : "en";
    }
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (key) el.innerHTML = t(key);
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.setAttribute("title", t(key));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) el.setAttribute("aria-label", t(key));
    });
  }

  return {
    SUPPORTED,
    dictionaries,
    normalizeLocale,
    setLocale,
    getLocale,
    t,
    formatDuration,
    applyI18n,
  };
});
