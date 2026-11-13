const { net } = require("electron");

const DEFAULT_API_BASE = "https://timeline.wangyang.wiki";

function requestJson(baseUrl, method, pathName, { token, body, locale } = {}) {
  const url = new URL(pathName, baseUrl.replace(/\/$/, "/") );
  return new Promise((resolve, reject) => {
    const req = net.request({
      method,
      url: url.toString(),
    });
    req.setHeader("Content-Type", "application/json");
    if (token) req.setHeader("Authorization", `Bearer ${token}`);
    if (locale) req.setHeader("X-TickNote-Locale", locale);

    let raw = "";
    req.on("response", (res) => {
      res.on("data", (chunk) => {
        raw += chunk.toString();
      });
      res.on("end", () => {
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { error: raw || "Invalid response" };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(
            new Error(
              data.error ||
                data.errorKey ||
                `Request failed (${res.statusCode})`
            )
          );
        }
      });
    });
    req.on("error", reject);
    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function createAccountClient(getState) {
  async function api(method, pathName, options = {}) {
    const { apiBase, token, locale } = getState();
    return requestJson(apiBase || DEFAULT_API_BASE, method, pathName, {
      token: options.withAuth === false ? null : token,
      body: options.body,
      locale: locale || "en",
    });
  }

  return {
    DEFAULT_API_BASE,
    register(username, password) {
      return api("POST", "/api/auth/register", {
        withAuth: false,
        body: { username, password },
      });
    },
    login(username, password) {
      return api("POST", "/api/auth/login", {
        withAuth: false,
        body: { username, password },
      });
    },
    me() {
      return api("GET", "/api/me");
    },
    push(sessions) {
      return api("POST", "/api/sync/push", { body: { sessions } });
    },
    pull(since) {
      const q = since ? `?since=${encodeURIComponent(since)}` : "";
      return api("GET", `/api/sync/pull${q}`);
    },
  };
}

function mergeSessions(localSessions, remoteSessions) {
  const map = new Map();
  for (const session of localSessions || []) {
    if (!session?.id) continue;
    map.set(session.id, {
      ...session,
      updatedAt:
        session.updatedAt || session.endedAt || session.startedAt || null,
    });
  }
  for (const remote of remoteSessions || []) {
    if (!remote?.id || remote.deleted) {
      if (remote?.deleted && remote.id) map.delete(remote.id);
      continue;
    }
    const local = map.get(remote.id);
    const remoteUpdated = remote.updatedAt || remote.endedAt || "";
    const localUpdated =
      (local && (local.updatedAt || local.endedAt || local.startedAt)) || "";
    if (!local || String(remoteUpdated) > String(localUpdated)) {
      map.set(remote.id, {
        id: remote.id,
        note: remote.note,
        rounds: remote.rounds,
        minutes: remote.minutes,
        device: remote.device || "",
        startedAt: remote.startedAt || null,
        endedAt: remote.endedAt || null,
        updatedAt: remote.updatedAt || remote.endedAt || null,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.endedAt || a.startedAt || 0).getTime();
    const tb = new Date(b.endedAt || b.startedAt || 0).getTime();
    return tb - ta;
  });
}

module.exports = {
  DEFAULT_API_BASE,
  createAccountClient,
  mergeSessions,
};
