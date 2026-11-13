const http = require("http");
const crypto = require("crypto");

function textResult(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function jsonResult(value) {
  return textResult(JSON.stringify(value, null, 2));
}

function buildSummary(sessions) {
  const byDay = new Map();
  const byDevice = new Map();
  const byHour = Array.from({ length: 24 }, () => 0);
  let totalMinutes = 0;
  let totalSessions = 0;

  for (const row of sessions) {
    const minutes = Number(row.minutes) || 0;
    totalMinutes += minutes;
    totalSessions += 1;
    const when = row.endedAt || row.startedAt || row.updatedAt;
    const date = when ? new Date(when) : null;
    if (date && !Number.isNaN(date.getTime())) {
      const day = date.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + minutes);
      byHour[date.getHours()] += minutes;
    }
    const device = row.device || "Unknown device";
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

function createLocalMcpTools() {
  return [
    {
      name: "ticknote_local_info",
      description: "Local TickNote info (machine name, data dir, session count)",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "ticknote_local_summary",
      description: "Local time summary",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "ticknote_local_list_sessions",
      description: "List recent local time sessions",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max rows, default 30, max 200" },
          query: { type: "string", description: "Optional note filter" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_local_search_notes",
      description:
        "Search local notes; space-separated words are AND, -word excludes",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keywords" },
          limit: { type: "number", description: "Max rows, default 30" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  ];
}

function parseSearchQuery(query) {
  const tokens = String(query || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const include = [];
  const exclude = [];
  for (const token of tokens) {
    if (token.startsWith("-") && token.length > 1) {
      exclude.push(token.slice(1).toLowerCase());
    } else if (!token.startsWith("-")) {
      include.push(token.toLowerCase());
    }
  }
  return { include, exclude };
}

function matchesQuery(session, query) {
  const { include, exclude } = parseSearchQuery(query);
  const hay = `${session.note || ""}\n${session.device || ""}`.toLowerCase();
  if (exclude.some((k) => hay.includes(k))) return false;
  if (!include.length) return true;
  return include.every((k) => hay.includes(k));
}

function createLocalMcpServer(options) {
  const {
    getSessions,
    getInfo,
    getToken,
    port = 3927,
  } = options;

  const tools = createLocalMcpTools();
  /** @type {import('http').Server | null} */
  let server = null;
  let listeningPort = 0;

  async function callTool(name, args = {}) {
    const sessions = (getSessions() || []).filter((s) => !s.deleted);
    switch (name) {
      case "ticknote_local_info":
        return jsonResult({ ...getInfo(), sessionCount: sessions.length });
      case "ticknote_local_summary":
        return jsonResult(buildSummary(sessions));
      case "ticknote_local_list_sessions": {
        const limit = Math.min(200, Math.max(1, Number(args.limit) || 30));
        const q = String(args.query || "").trim();
        let rows = [...sessions].sort((a, b) => {
          const ta = new Date(a.endedAt || a.startedAt || 0).getTime();
          const tb = new Date(b.endedAt || b.startedAt || 0).getTime();
          return tb - ta;
        });
        if (q) rows = rows.filter((s) => matchesQuery(s, q));
        return jsonResult(
          rows.slice(0, limit).map((s) => ({
            id: s.id,
            note: s.note,
            minutes: s.minutes,
            rounds: s.rounds,
            device: s.device,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
          }))
        );
      }
      case "ticknote_local_search_notes": {
        const q = String(args.query || "").trim();
        if (!q) return textResult("Please provide query");
        const limit = Math.min(100, Math.max(1, Number(args.limit) || 30));
        const rows = sessions
          .filter((s) => matchesQuery(s, q))
          .sort((a, b) => {
            const ta = new Date(a.endedAt || a.startedAt || 0).getTime();
            const tb = new Date(b.endedAt || b.startedAt || 0).getTime();
            return tb - ta;
          })
          .slice(0, limit)
          .map((s) => ({
            id: s.id,
            note: s.note,
            minutes: s.minutes,
            endedAt: s.endedAt || s.startedAt,
            device: s.device,
          }));
        return jsonResult({ query: q, count: rows.length, sessions: rows });
      }
      default:
        return textResult(`Unknown tool: ${name}`);
    }
  }

  function unauthorized(res, id) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: Bearer MCP token required" },
        id: id ?? null,
      })
    );
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  }

  function checkAuth(req) {
    const expected = String(getToken() || "").trim();
    if (!expected) return true;
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return token === expected;
  }

  async function handleJsonRpc(req, res, body) {
    if (!checkAuth(req)) {
      unauthorized(res, body?.id);
      return;
    }

    const method = body?.method;
    const id = body?.id ?? null;

    const send = (payload, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };

    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "ticknote-local", version: "1.5.0" },
        },
      });
      return;
    }

    if (method === "notifications/initialized" || method === "initialized") {
      res.writeHead(202);
      res.end();
      return;
    }

    if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
      return;
    }

    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools } });
      return;
    }

    if (method === "tools/call") {
      try {
        const result = await callTool(body?.params?.name, body?.params?.arguments || {});
        send({ jsonrpc: "2.0", id, result });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id,
          result: textResult(`Tool failed: ${err.message || err}`),
          isError: true,
        });
      }
      return;
    }

    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }

  async function start(desiredPort = port) {
    if (server) await stop();
    server = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/mcp" && url.pathname !== "/") {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            name: "ticknote-local",
            transport: "streamable-http-json",
            endpoint: "/mcp",
            auth: getToken() ? "Authorization: Bearer <token>" : "optional",
            tools: tools.map((t) => t.name),
            running: true,
            port: listeningPort,
          })
        );
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      try {
        const body = await readBody(req);
        await handleJsonRpc(req, res, body);
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: err.message || "Parse error" },
            id: null,
          })
        );
      }
    });

    try {
      await new Promise((resolve, reject) => {
        const onError = (err) => {
          server?.off?.("listening", onListening);
          reject(err);
        };
        const onListening = () => {
          server?.off?.("error", onError);
          const addr = server.address();
          listeningPort = typeof addr === "object" && addr ? addr.port : desiredPort;
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(desiredPort, "127.0.0.1");
      });
    } catch (err) {
      const failed = server;
      server = null;
      listeningPort = 0;
      if (failed) {
        try {
          failed.close();
        } catch {
          // ignore
        }
      }
      throw err;
    }

    return listeningPort;
  }

  async function stop() {
    if (!server) {
      listeningPort = 0;
      return;
    }
    const current = server;
    server = null;
    listeningPort = 0;
    await new Promise((resolve) => {
      current.close(() => resolve());
      // Force resolve if already closed / never listening
      setTimeout(resolve, 300);
    });
  }

  function status() {
    const running = Boolean(server && listeningPort);
    return {
      running,
      port: listeningPort || port,
      url: running ? `http://127.0.0.1:${listeningPort}/mcp` : "",
    };
  }

  return { start, stop, status, tools };
}

function newLocalMcpToken() {
  return `tnl_${crypto.randomBytes(20).toString("hex")}`;
}

module.exports = {
  createLocalMcpServer,
  newLocalMcpToken,
  buildSummary,
};
