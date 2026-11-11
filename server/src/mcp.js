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
      description: "返回当前登录用户的资料与公开主页地址",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "ticknote_summary",
      description: "获取当前用户的时间统计摘要（总时长、活跃天、设备、小时分布）",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "ticknote_list_sessions",
      description: "列出最近的时间记录",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "返回条数，默认 30，最大 200",
          },
          query: {
            type: "string",
            description: "按备注关键词过滤（可选）",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_search_notes",
      description: "在备注中搜索时间记录",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
          limit: { type: "number", description: "返回条数，默认 20" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_public_profile",
      description: "读取某用户的公开主页（仅当对方开启公开时）",
      inputSchema: {
        type: "object",
        properties: {
          username: { type: "string", description: "用户名" },
        },
        required: ["username"],
        additionalProperties: false,
      },
    },
    {
      name: "ticknote_update_settings",
      description: "更新当前用户设置：显示名、简介、是否公开、公开标题",
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
      description: "查看或重新生成长期 MCP 访问令牌（用于 Cursor 等客户端）",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["status", "rotate", "revoke"],
            description: "status=查看是否已有令牌；rotate=生成新令牌；revoke=作废",
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
        if (!q) return textResult("请提供 query");
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
          return textResult("公开主页不存在或未开启");
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
          return textResult("MCP 令牌已作废");
        }
        if (action === "rotate") {
          const token = issueMcpToken(user.id);
          return jsonResult({
            token,
            hint: "请把此令牌放到 Authorization: Bearer ...，只显示一次请妥善保存",
          });
        }
        return jsonResult({
          hasToken: Boolean(user.mcp_token),
          hint: "使用 action=rotate 生成新令牌",
        });
      }
      default:
        return textResult(`未知工具: ${name}`);
    }
  }

  async function handleJsonRpc(req, res, body) {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: Bearer JWT 或 MCP Token" },
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
          result: textResult(`工具执行失败: ${err.message || err}`),
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
