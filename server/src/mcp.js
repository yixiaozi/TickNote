const crypto = require("crypto");

function textResult(text) {
  return {
    content: [{ type: "text", text: String(text) }],
  };
}

function jsonResult(value) {
  return textResult(JSON.stringify(value, null, 2));
}

function createMcpHandler({
  getUserFromAuth,
  getUserByMcpToken,
  listSessionsForUser,
  buildSummary,
  getUserByUsername,
  userPublicFields,
  issueMcpToken,
  revokeMcpToken,
  updateSettings,
}) {
  const tools = [
    {
      name: "ticknote_whoami",
      description: "Return the current user's profile and public page URL",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "ticknote_summary",
      description:
        "Get the current user's time summary (total minutes, active days, devices, hourly distribution)",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "ticknote_list_sessions",
      description: "List recent time sessions",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of sessions to return (default 30, max 200)",
          },
          query: {
            type: "string",
            description: "Optional note keyword filter",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_search_notes",
      description: "Search time sessions by note text",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword" },
          limit: { type: "number", description: "Number of results (default 20)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_public_profile",
      description: "Read a user's public page (only if they enabled sharing)",
      inputSchema: {
        type: "object",
        properties: {
          username: { type: "string", description: "Username" },
        },
        required: ["username"],
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_update_settings",
      description:
        "Update current user settings: display name, bio, public flag, public title",
      inputSchema: {
        type: "object",
        properties: {
          displayName: { type: "string" },
          bio: { type: "string" },
          isPublic: { type: "boolean" },
          publicTitle: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_mcp_token",
      description:
        "Inspect or rotate the long-lived MCP access token (for Cursor and similar clients)",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["status", "rotate", "revoke"],
            description:
              "status=check whether a token exists; rotate=issue a new token; revoke=invalidate",
          },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
  ];

  async function resolveUser(req) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return null;
    return (
      getUserFromAuth(token) ||
      getUserByMcpToken(token) ||
      null
    );
  }

  async function callTool(user, name, args = {}) {
    switch (name) {
      case "ticknote_whoami":
        return jsonResult(userPublicFields(user));
      case "ticknote_summary":
        return jsonResult(buildSummary(listSessionsForUser(user.id)));
      case "ticknote_list_sessions": {
        const limit = Math.min(200, Math.max(1, Number(args.limit) || 30));
        const q = String(args.query || "").trim().toLowerCase();
        let rows = listSessionsForUser(user.id);
        if (q) {
          rows = rows.filter((s) => String(s.note || "").toLowerCase().includes(q));
        }
        return jsonResult(
          rows.slice(0, limit).map((s) => ({
            id: s.id,
            note: s.note,
            minutes: s.minutes,
            rounds: s.rounds,
            device: s.device,
            startedAt: s.started_at,
            endedAt: s.ended_at,
          }))
        );
      }
      case "ticknote_search_notes": {
        const q = String(args.query || "").trim().toLowerCase();
        if (!q) return textResult("Please provide a query");
        const limit = Math.min(100, Math.max(1, Number(args.limit) || 20));
        const rows = listSessionsForUser(user.id)
          .filter((s) => String(s.note || "").toLowerCase().includes(q))
          .slice(0, limit)
          .map((s) => ({
            id: s.id,
            note: s.note,
            minutes: s.minutes,
            endedAt: s.ended_at || s.started_at,
            device: s.device,
          }));
        return jsonResult({ query: q, count: rows.length, sessions: rows });
      }
      case "ticknote_public_profile": {
        const username = String(args.username || "").trim();
        const target = getUserByUsername(username);
        if (!target || !target.is_public) {
          return textResult("Public page not found or not enabled");
        }
        const sessions = listSessionsForUser(target.id);
        return jsonResult({
          profile: userPublicFields(target),
          summary: buildSummary(sessions),
          recent: sessions.slice(0, 40).map((s) => ({
            note: s.note,
            minutes: s.minutes,
            endedAt: s.ended_at || s.started_at,
          })),
        });
      }
      case "ticknote_update_settings": {
        const next = updateSettings(user.id, args || {});
        return jsonResult(userPublicFields(next));
      }
      case "ticknote_mcp_token": {
        const action = String(args.action || "status");
        if (action === "revoke") {
          revokeMcpToken(user.id);
          return textResult("MCP token revoked");
        }
        if (action === "rotate") {
          const token = issueMcpToken(user.id);
          return jsonResult({
            token,
            hint: "Put this token in Authorization: Bearer ... — shown only once, store it securely",
          });
        }
        return jsonResult({
          hasToken: Boolean(user.mcp_token),
          hint: "Use action=rotate to issue a new token",
        });
      }
      default:
        return textResult(`Unknown tool: ${name}`);
    }
  }

  async function handleJsonRpc(req, res, body) {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: Bearer JWT or MCP Token required",
        },
        id: body?.id ?? null,
      });
      return;
    }

    const method = body?.method;
    const id = body?.id ?? null;

    if (method === "initialize") {
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "ticknote-timeline", version: "1.5.0" },
        },
      });
      return;
    }

    if (method === "notifications/initialized" || method === "initialized") {
      res.status(202).end();
      return;
    }

    if (method === "ping") {
      res.json({ jsonrpc: "2.0", id, result: {} });
      return;
    }

    if (method === "tools/list") {
      res.json({ jsonrpc: "2.0", id, result: { tools } });
      return;
    }

    if (method === "tools/call") {
      const name = body?.params?.name;
      const args = body?.params?.arguments || {};
      try {
        const result = await callTool(user, name, args);
        res.json({ jsonrpc: "2.0", id, result });
      } catch (err) {
        res.json({
          jsonrpc: "2.0",
          id,
          result: textResult(`Tool failed: ${err.message || err}`),
          isError: true,
        });
      }
      return;
    }

    res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }

  return { handleJsonRpc, tools };
}

function newMcpToken() {
  return `tn_${crypto.randomBytes(24).toString("hex")}`;
}

module.exports = { createMcpHandler, newMcpToken };
