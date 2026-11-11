const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("./db");
const { createMcpHandler, newMcpToken } = require("./mcp");

const PORT = Number(process.env.PORT || 3015);
const HOST = process.env.HOST || "127.0.0.1";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto
    .createHash("sha256")
    .update(`ticknote-timeline-${HOST}-${PORT}`)
    .digest("hex");
const TOKEN_DAYS = Number(process.env.TOKEN_DAYS || 90);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(PUBLIC_DIR));

function nowIso() {
  return new Date().toISOString();
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: `${TOKEN_DAYS}d` }
  );
}

function userPublicFields(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    bio: row.bio || "",
    isPublic: Boolean(row.is_public),
    publicTitle: row.public_title || "",
    createdAt: row.created_at,
    publicUrl: `/${encodeURIComponent(row.username)}/public`,
    hasMcpToken: Boolean(row.mcp_token),
    mcpUrl: "/mcp",
  };
}

function getUserById(id) {
  return db
    .prepare(
      `SELECT id, username, display_name, bio, is_public, public_title, created_at, mcp_token
       FROM users WHERE id = ?`
    )
    .get(id);
}

function getUserByUsername(username) {
  return db
    .prepare(
      `SELECT id, username, display_name, bio, is_public, public_title, created_at, password_hash, mcp_token
       FROM users WHERE username = ? COLLATE NOCASE`
    )
    .get(username);
}

function getUserByMcpToken(token) {
  if (!token) return null;
  return db
    .prepare(
      `SELECT id, username, display_name, bio, is_public, public_title, created_at, mcp_token
       FROM users WHERE mcp_token = ?`
    )
    .get(token);
}

function getUserFromAuthJwt(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return getUserById(payload.sub);
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "未登录" });
  const user = getUserFromAuthJwt(token) || getUserByMcpToken(token);
  if (!user) return res.status(401).json({ error: "登录已失效" });
  req.user = user;
  next();
}

function applyUserSettings(userId, body = {}) {
  const current = getUserById(userId);
  const displayName = String(body.displayName ?? current.display_name ?? "")
    .trim()
    .slice(0, 40);
  const bio = String(body.bio ?? current.bio ?? "").trim().slice(0, 280);
  const publicTitle = String(body.publicTitle ?? current.public_title ?? "")
    .trim()
    .slice(0, 80);
  const isPublic =
    typeof body.isPublic === "boolean"
      ? body.isPublic
        ? 1
        : 0
      : current.is_public
        ? 1
        : 0;
  db.prepare(
    `UPDATE users
     SET display_name = ?, bio = ?, public_title = ?, is_public = ?
     WHERE id = ?`
  ).run(displayName || current.username, bio, publicTitle, isPublic, userId);
  return getUserById(userId);
}

function normalizeSession(raw, fallbackUpdatedAt) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  if (!id) return null;
  const updatedAt = String(
    raw.updatedAt || raw.endedAt || raw.startedAt || fallbackUpdatedAt || nowIso()
  );
  return {
    id,
    note: String(raw.note || "").trim() || "未命名",
    rounds: Math.max(0, Number(raw.rounds) || 0),
    minutes: Math.max(0, Number(raw.minutes) || 0),
    device: String(raw.device || "").trim(),
    started_at: raw.startedAt || raw.started_at || null,
    ended_at: raw.endedAt || raw.ended_at || null,
    updated_at: updatedAt,
    deleted: raw.deleted ? 1 : 0,
  };
}

function rowToSession(row) {
  return {
    id: row.id,
    note: row.note,
    rounds: row.rounds,
    minutes: row.minutes,
    device: row.device,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
    deleted: Boolean(row.deleted),
  };
}

function buildSummary(rows) {
  const byDay = new Map();
  const byDevice = new Map();
  const byHour = Array.from({ length: 24 }, () => 0);
  let totalMinutes = 0;
  let totalSessions = 0;

  for (const row of rows) {
    const minutes = Number(row.minutes) || 0;
    totalMinutes += minutes;
    totalSessions += 1;
    const when = row.ended_at || row.started_at || row.updated_at;
    const date = when ? new Date(when) : null;
    if (date && !Number.isNaN(date.getTime())) {
      const day = date.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + minutes);
      byHour[date.getHours()] += minutes;
    }
    const device = row.device || "未知设备";
    byDevice.set(device, (byDevice.get(device) || 0) + minutes);
  }

  return {
    totalSessions,
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    averageMinutes:
      totalSessions > 0
        ? Math.round((totalMinutes / totalSessions) * 10) / 10
        : 0,
    activeDays: byDay.size,
    days: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, minutes]) => ({
        date,
        minutes: Math.round(minutes * 10) / 10,
      })),
    devices: [...byDevice.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([device, minutes]) => ({
        device,
        minutes: Math.round(minutes * 10) / 10,
      })),
    hours: byHour.map((minutes, hour) => ({
      hour,
      minutes: Math.round(minutes * 10) / 10,
    })),
  };
}

function listSessionsForUser(userId) {
  return db
    .prepare(
      `SELECT * FROM sessions
       WHERE user_id = ? AND deleted = 0
       ORDER BY COALESCE(ended_at, started_at, updated_at) DESC`
    )
    .all(userId);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ticknote-timeline" });
});

app.get("/api/meta", (_req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const sessions = db
    .prepare("SELECT COUNT(*) AS c FROM sessions WHERE deleted = 0")
    .get().c;
  const publicUsers = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE is_public = 1")
    .get().c;
  res.json({ users, sessions, publicUsers });
});

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!/^[a-zA-Z0-9_\u4e00-\u9fff.-]{2,32}$/.test(username)) {
    return res.status(400).json({ error: "用户名需 2-32 位（字母/数字/中文/._-）" });
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: "密码需 6-72 位" });
  }
  if (getUserByUsername(username)) {
    return res.status(409).json({ error: "用户名已被占用" });
  }
  const createdAt = nowIso();
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, created_at, display_name)
       VALUES (?, ?, ?, ?)`
    )
    .run(username, bcrypt.hashSync(password, 10), createdAt, username);
  const user = getUserById(info.lastInsertRowid);
  res.status(201).json({
    token: signToken(user),
    user: userPublicFields(user),
  });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const row = getUserByUsername(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }
  const user = getUserById(row.id);
  res.json({
    token: signToken(user),
    user: userPublicFields(user),
  });
});

app.get("/api/me", authRequired, (req, res) => {
  res.json(userPublicFields(req.user));
});

app.get("/api/settings", authRequired, (req, res) => {
  res.json(userPublicFields(req.user));
});

app.put("/api/settings", authRequired, (req, res) => {
  const user = applyUserSettings(req.user.id, req.body || {});
  res.json(userPublicFields(user));
});

app.post("/api/mcp/token", authRequired, (req, res) => {
  const action = String(req.body?.action || "rotate");
  if (action === "revoke") {
    db.prepare("UPDATE users SET mcp_token = NULL WHERE id = ?").run(req.user.id);
    return res.json({ ok: true, hasMcpToken: false });
  }
  const token = newMcpToken();
  db.prepare("UPDATE users SET mcp_token = ? WHERE id = ?").run(token, req.user.id);
  res.json({
    ok: true,
    hasMcpToken: true,
    token,
    mcpUrl: `${req.protocol}://${req.get("host")}/mcp`,
  });
});

const mcp = createMcpHandler({
  getUserFromAuth: getUserFromAuthJwt,
  getUserByMcpToken,
  listSessionsForUser,
  buildSummary,
  getUserByUsername,
  userPublicFields,
  issueMcpToken(userId) {
    const token = newMcpToken();
    db.prepare("UPDATE users SET mcp_token = ? WHERE id = ?").run(token, userId);
    return token;
  },
  revokeMcpToken(userId) {
    db.prepare("UPDATE users SET mcp_token = NULL WHERE id = ?").run(userId);
  },
  updateSettings: applyUserSettings,
});

app.post("/mcp", async (req, res) => {
  try {
    await mcp.handleJsonRpc(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.json({
    name: "ticknote-timeline",
    transport: "streamable-http-json",
    endpoint: "/mcp",
    auth: "Authorization: Bearer <jwt or mcp token>",
    tools: mcp.tools.map((t) => t.name),
  });
});

app.post("/api/sync/push", authRequired, (req, res) => {
  const items = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
  const stamp = nowIso();
  const upsert = db.prepare(`
    INSERT INTO sessions (
      id, user_id, note, rounds, minutes, device,
      started_at, ended_at, updated_at, deleted
    ) VALUES (
      @id, @user_id, @note, @rounds, @minutes, @device,
      @started_at, @ended_at, @updated_at, @deleted
    )
    ON CONFLICT(user_id, id) DO UPDATE SET
      note = excluded.note,
      rounds = excluded.rounds,
      minutes = excluded.minutes,
      device = excluded.device,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      updated_at = excluded.updated_at,
      deleted = excluded.deleted
    WHERE excluded.updated_at >= sessions.updated_at
  `);

  const tx = db.transaction((list) => {
    let accepted = 0;
    for (const raw of list) {
      const session = normalizeSession(raw, stamp);
      if (!session) continue;
      const result = upsert.run({ ...session, user_id: req.user.id });
      if (result.changes > 0) accepted += 1;
    }
    return accepted;
  });

  res.json({ ok: true, accepted: tx(items), total: items.length });
});

app.get("/api/sync/pull", authRequired, (req, res) => {
  const since = String(req.query.since || "").trim();
  const rows = since
    ? db
        .prepare(
          `SELECT * FROM sessions
           WHERE user_id = ? AND updated_at > ?
           ORDER BY updated_at ASC`
        )
        .all(req.user.id, since)
    : db
        .prepare(
          `SELECT * FROM sessions
           WHERE user_id = ? AND deleted = 0
           ORDER BY updated_at ASC`
        )
        .all(req.user.id);
  res.json({ sessions: rows.map(rowToSession), serverTime: nowIso() });
});

app.get("/api/sessions", authRequired, (req, res) => {
  res.json({ sessions: listSessionsForUser(req.user.id).map(rowToSession) });
});

app.get("/api/stats/summary", authRequired, (req, res) => {
  res.json(buildSummary(listSessionsForUser(req.user.id)));
});

app.get("/api/public/:username", (req, res) => {
  const user = getUserByUsername(String(req.params.username || "").trim());
  if (!user || !user.is_public) {
    return res.status(404).json({ error: "公开主页不存在或未开启" });
  }
  const sessions = listSessionsForUser(user.id);
  res.json({
    profile: userPublicFields(user),
    summary: buildSummary(sessions),
    sessions: sessions.slice(0, 200).map(rowToSession),
  });
});

app.get("/api/public-users", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, username, display_name, bio, is_public, public_title, created_at
       FROM users WHERE is_public = 1
       ORDER BY username COLLATE NOCASE ASC
       LIMIT 100`
    )
    .all();
  res.json({
    users: rows.map((row) => userPublicFields(row)),
  });
});

function sendPage(res, name) {
  res.sendFile(path.join(PUBLIC_DIR, name));
}

app.get("/app", (_req, res) => sendPage(res, "app.html"));
app.get("/settings", (_req, res) => sendPage(res, "settings.html"));
app.get("/login", (_req, res) => sendPage(res, "login.html"));
app.get("/:username/public", (req, res, next) => {
  const username = String(req.params.username || "");
  if (
    ["api", "app", "settings", "login", "mcp", "assets", "css", "js"].includes(
      username.toLowerCase()
    )
  ) {
    return next();
  }
  sendPage(res, "public.html");
});

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  if (req.path.includes(".")) return next();
  sendPage(res, "index.html");
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "服务器错误" });
});

app.listen(PORT, HOST, () => {
  console.log(`ticknote-timeline listening on http://${HOST}:${PORT}`);
});
