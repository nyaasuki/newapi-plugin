// End-to-end test of New API's upstream price sync with the OpenRouter
// Decision price feed (pricing/nyaasuki_decision.json).
//
//   node test/decision/e2e/price-sync.mjs --server http://127.0.0.1:13000 [--relay http://127.0.0.1:13001] [--feed <url>]
//
// Without --feed the script serves this repository on 127.0.0.1:18091 and syncs
// from the local feed; pass the raw GitHub URL to test the published one.
// Gateway A gets the plugin, a Task Plugin (61) channel pointing at the local
// OpenRouter mock, and its prices from the feed through the same calls the
// dashboard's price sync makes. Then it checks what calls are charged. Gateway
// B, when given, syncs the prices from gateway A's /api/pricing through a New
// API (60) channel.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startMock, MOCK_KEY } from "./mock-openrouter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

// The newest version directory of a plugin.
function latestVersion(dir) {
  const versions = readdirSync(dir).filter((name) => /^\d+\.\d+\.\d+$/.test(name));
  versions.sort((a, b) => a.split(".").map(Number).reduce((r, v, i) => r || v - b.split(".").map(Number)[i], 0));
  return versions[versions.length - 1];
}
const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf("--" + name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const SERVER_A = option("server", "http://127.0.0.1:13000").replace(/\/+$/, "");
const SERVER_B = option("relay", "") ? option("relay").replace(/\/+$/, "") : null;
const MOCK_PORT = Number(option("mock-port", 18080));
const FILE_PORT = 18091;
const FEED_URL = option("feed", "http://127.0.0.1:" + FILE_PORT + "/pricing/nyaasuki_decision.json");
const PLUGIN_PATH = join(root, "plugins/tasks/nyaasuki_decision", latestVersion(join(root, "plugins/tasks/nyaasuki_decision")), "plugin.js");
const ADMIN = { username: "e2eroot", password: "E2e-Test-Pass-2026" };
const QUOTA_PER_USD = 500000;

const plugin = await import(pathToFileURL(PLUGIN_PATH).href);
const MODELS = plugin.meta.models;
const snapshot = JSON.parse(readFileSync(join(root, "tools/decision/models.snapshot.json"), "utf8"));
const catalog = Object.fromEntries(snapshot.models.map((m) => [m.id, { prompt: Number(m.prompt), request: Number(m.request) }]));

let failures = 0;
function check(name, condition, detail) {
  console.log((condition ? "PASS " : "FAIL ") + name + (condition || detail === undefined ? "" : "\n     " + JSON.stringify(detail).slice(0, 800)));
  if (!condition) failures++;
}

function serveRepository() {
  const server = createServer(async (req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(root + sep)) return res.writeHead(403).end();
    try {
      const body = await readFile(path);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((done) => server.listen(FILE_PORT, "127.0.0.1", () => done(server)));
}

class Gateway {
  constructor(base) {
    this.base = base;
  }
  async api(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.accessToken) headers.Authorization = "Bearer " + this.accessToken;
    if (this.userId) headers["New-Api-User"] = String(this.userId);
    const response = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    try {
      return { status: response.status, body: JSON.parse(text) };
    } catch {
      return { status: response.status, body: text };
    }
  }
  async must(method, path, body) {
    const result = await this.api(method, path, body);
    if (result.status >= 300 || (result.body && result.body.success === false))
      throw new Error(this.base + ": " + method + " " + path + " failed: " + result.status + " " + JSON.stringify(result.body).slice(0, 500));
    return result.body;
  }
  async init() {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(this.base + "/api/status")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    const setup = await this.api("GET", "/api/setup");
    if (!(setup.body && setup.body.data && setup.body.data.status))
      await this.must("POST", "/api/setup", { username: ADMIN.username, password: ADMIN.password, confirmPassword: ADMIN.password });
    const login = await this.must("POST", "/api/user/login", ADMIN);
    this.userId = login.data.user.id;
    this.accessToken = login.data.access_token;
    await this.must("POST", "/api/plugin/task", { source: readFileSync(PLUGIN_PATH, "utf8"), remark: "price sync test" });
  }
  async addChannel(channel) {
    await this.must("POST", "/api/channel/", { mode: "single", channel: { group: "default", models: MODELS.join(","), ...channel } });
    const list = await this.must("GET", "/api/channel/?p=1&page_size=100");
    return (list.data.items || list.data).find((c) => c.name === channel.name);
  }
  async issueToken(name) {
    await this.must("POST", "/api/token/", { name, remain_quota: 0, unlimited_quota: true, expired_time: -1 });
    const tokens = await this.must("GET", "/api/token/?p=1&size=50");
    const id = (tokens.data.items || tokens.data).find((t) => t.name === name).id;
    const key = await this.must("POST", "/api/token/" + id + "/key");
    return "sk-" + String(key.data.key).replace(/^sk-/, "");
  }
  // The dashboard's price sync: fetch from the selected upstreams, then save
  // the chosen rows through the model pricing editor.
  async fetchPrices(upstreams) {
    const result = await this.must("POST", "/api/ratio_sync/fetch", { upstreams, timeout: 10, include_unchanged: true });
    return result.data;
  }
  async applyPrices(prices, source, models) {
    const config = await this.must("GET", "/api/option/model_pricing?" + models.map((m) => "model=" + encodeURIComponent(m)).join("&"));
    const entries = Object.fromEntries((config.data.entries || []).map((entry) => [entry.model_name, entry]));
    const changes = [];
    for (const model of models) {
      const values = prices[model] && prices[model].upstreams[source];
      if (!values) continue;
      const entry = entries[model];
      const pricing = { ...((entry && entry.configured) || {}) };
      pricing["billing_setting.billing_mode"] = values.billing_mode;
      pricing["billing_setting.billing_expr"] = values.billing_expr;
      changes.push({ model_name: model, expected_version: (entry && entry.version) || config.data.empty_version, pricing });
    }
    await this.must("PATCH", "/api/option/model_pricing", { changes });
    return changes.length;
  }
  async decide(token, body) {
    const response = await fetch(this.base + "/decision/v1/systemone", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      return { status: response.status, body: JSON.parse(text) };
    } catch {
      return { status: response.status, body: text };
    }
  }
  async lastLog(model) {
    const logs = await this.must("GET", "/api/log/?p=1&page_size=50&type=2");
    return (logs.data.items || logs.data).find((item) => item.model_name === model);
  }
}

function upstreamName(channel) {
  return channel.name + "(" + channel.id + ")";
}

async function main() {
  const local = !argv.includes("--feed");
  const fileServer = local ? await serveRepository() : null;
  const { server: mock } = await startMock(MOCK_PORT, catalog);
  try {
    const feed = await (await fetch(FEED_URL)).json();
    const feedExpressions = feed.data.billing_expr;
    check("the feed prices every whitelisted model (" + MODELS.length + ")", MODELS.every((m) => feed.data.billing_mode[m] === "tiered_expr" && feedExpressions[m]), MODELS.filter((m) => !feedExpressions[m]));

    console.log("\n== Gateway A: sync from the price feed");
    const a = new Gateway(SERVER_A);
    await a.init();
    const channel = await a.addChannel({
      type: 61,
      name: "openrouter-decision",
      key: MOCK_KEY,
      base_url: "http://127.0.0.1:" + MOCK_PORT,
      setting: JSON.stringify({ task_plugin_key: "nyaasuki_decision" }),
    });
    const syncable = await a.must("GET", "/api/ratio_sync/channels");
    check("the Task Plugin channel is offered for price sync", (syncable.data || []).some((c) => c.id === channel.id), syncable.data);

    const source = upstreamName(channel);
    let data = await a.fetchPrices([{ id: channel.id, name: channel.name, base_url: channel.base_url, endpoint: FEED_URL }]);
    check("fetching the feed succeeds", data.test_results.every((r) => r.status === "success"), data.test_results);
    const offered = MODELS.filter((m) => data.prices[m] && data.prices[m].upstreams[source]);
    check("price sync offers all " + MODELS.length + " models", offered.length === MODELS.length, MODELS.filter((m) => !offered.includes(m)));
    check(
      "each offered price is the feed's task expression",
      offered.every((m) => data.prices[m].upstreams[source].billing_mode === "tiered_expr" && data.prices[m].upstreams[source].billing_expr === feedExpressions[m]),
      offered.find((m) => data.prices[m].upstreams[source].billing_expr !== feedExpressions[m]),
    );
    check("all " + MODELS.length + " models differ from the unpriced gateway", MODELS.every((m) => data.differences[m]), Object.keys(data.differences).length);

    const saved = await a.applyPrices(data.prices, source, MODELS);
    check("applying the sync saves " + MODELS.length + " model prices", saved === MODELS.length, saved);
    data = await a.fetchPrices([{ id: channel.id, name: channel.name, base_url: channel.base_url, endpoint: FEED_URL }]);
    check("after applying, no model differs from the feed", MODELS.every((m) => !data.differences[m]), Object.keys(data.differences));

    const token = await a.issueToken("price-sync");
    let reply = await a.decide(token, { model: "d1.1", state: "The package arrived crushed. ".repeat(1500), questions: { refund: { type: "noul" } } });
    let log = await a.lastLog("d1.1");
    const d11 = Math.round((reply.body.usage.input_tokens * 0.02 * QUOTA_PER_USD) / 1e6);
    check("d1.1 is charged at the synced price (" + reply.body.usage.input_tokens + " tokens -> quota " + d11 + ")", reply.status === 200 && log && Math.abs(log.quota - d11) <= 1, log && log.quota);
    reply = await a.decide(token, { model: "decisions-fast", state: "hello", questions: { q: { type: "noul" } } });
    log = await a.lastLog("decisions-fast");
    check("decisions-fast is charged its synced 0.001 USD request fee (quota 500)", reply.status === 200 && log && log.quota === 500, log && log.quota);
    reply = await a.decide(token, { model: "gemini-decision-1", state: "x".repeat(4000), questions: { q: { type: "noul" } } });
    log = await a.lastLog("gemini-decision-1");
    const gemini = Math.round(reply.body.usage.cost * QUOTA_PER_USD);
    check("gemini-decision-1 is charged OpenRouter's reported cost (quota " + gemini + ")", reply.status === 200 && log && Math.abs(log.quota - gemini) <= 1, log && log.quota);
    reply = await a.decide(token, { model: "pplx-decider-v1.3:free", state: "hello", questions: { q: { type: "noul" } } });
    log = await a.lastLog("pplx-decider-v1.3:free");
    check("a free model is charged nothing", reply.status === 200 && log && log.quota === 0, log && log.quota);

    if (SERVER_B) {
      console.log("\n== Gateway B: sync from gateway A's /api/pricing");
      const b = new Gateway(SERVER_B);
      await b.init();
      const relay = await b.addChannel({
        type: 60,
        name: "gateway-a",
        key: token,
        base_url: SERVER_A,
        setting: JSON.stringify({ task_extend_plugin_keys: ["nyaasuki_decision"] }),
      });
      const relaySource = upstreamName(relay);
      const relayData = await b.fetchPrices([{ id: relay.id, name: relay.name, base_url: relay.base_url, endpoint: "/api/pricing" }]);
      check("fetching gateway A's /api/pricing succeeds", relayData.test_results.every((r) => r.status === "success"), relayData.test_results);
      const relayed = MODELS.filter((m) => relayData.prices[m] && relayData.prices[m].upstreams[relaySource]);
      check("gateway A offers all " + MODELS.length + " model prices", relayed.length === MODELS.length, MODELS.filter((m) => !relayed.includes(m)));
      check(
        "gateway A's prices are the feed's task expressions",
        relayed.every((m) => relayData.prices[m].upstreams[relaySource].billing_expr === feedExpressions[m]),
        relayed.find((m) => relayData.prices[m].upstreams[relaySource].billing_expr !== feedExpressions[m]),
      );
      const relaySaved = await b.applyPrices(relayData.prices, relaySource, MODELS);
      const relayToken = await b.issueToken("price-sync");
      const relayReply = await b.decide(relayToken, { model: "decisions-fast", state: "hello", questions: { q: { type: "noul" } } });
      const relayLog = await b.lastLog("decisions-fast");
      check("gateway B charges the synced price (" + relaySaved + " saved, decisions-fast quota 500)", relayReply.status === 200 && relayLog && relayLog.quota === 500, relayLog && relayLog.quota);
    }
  } finally {
    mock.close();
    if (fileServer) fileServer.close();
  }
  console.log(failures === 0 ? "\nAll checks passed" : "\n" + failures + " check(s) failed");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
