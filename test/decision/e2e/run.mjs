// End-to-end test of the OpenRouter Decision plugin in real New API servers.
//
//   node test/decision/e2e/run.mjs --server http://127.0.0.1:13000 [--relay http://127.0.0.1:13001] [--mock-port 18080] [--real]
//
// Both servers must be fresh installs (the test runs their initial setup).
// Gateway A gets a Task Plugin (61) channel pointing at a local mock of
// OpenRouter. Gateway B, when given, gets a New API (60) channel pointing at
// gateway A. With --real, gateway A finally switches to a 61 channel with an
// empty address and a dummy key, so one request reaches https://openrouter.ai
// and must come back as OpenRouter's 401.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startMock, MOCK_KEY, MOCK_USER_ID } from "./mock-openrouter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

// The newest version directory of a plugin.
function latestVersion(dir) {
  const versions = readdirSync(dir).filter((name) => /^\d+\.\d+\.\d+$/.test(name));
  versions.sort((a, b) => a.split(".").map(Number).reduce((r, v, i) => r || v - b.split(".").map(Number)[i], 0));
  return versions[versions.length - 1];
}
const argv = process.argv.slice(2);
const option = (name) => {
  const index = argv.indexOf("--" + name);
  return index >= 0 ? argv[index + 1] : undefined;
};
const SERVER_A = (option("server") || "http://127.0.0.1:13000").replace(/\/+$/, "");
const SERVER_B = option("relay") ? option("relay").replace(/\/+$/, "") : null;
const REAL = argv.includes("--real");
const MOCK_PORT = Number(option("mock-port") || 18080);
const PLUGIN_PATH = resolve(option("plugin") || join(root, "plugins/tasks/nyaasuki_decision", latestVersion(join(root, "plugins/tasks/nyaasuki_decision")), "plugin.js"));
const ADMIN = { username: "e2eroot", password: "E2e-Test-Pass-2026" };
const QUOTA_PER_USD = 500000;

const snapshot = JSON.parse(readFileSync(join(root, "tools/decision/models.snapshot.json"), "utf8"));
const suggested = JSON.parse(readFileSync(join(root, "tools/decision/pricing.suggested.json"), "utf8")).models;
const catalog = Object.fromEntries(snapshot.models.map((m) => [m.id, { prompt: Number(m.prompt), request: Number(m.request) }]));
const plugin = await import(pathToFileURL(PLUGIN_PATH).href);

let failures = 0;
function check(name, condition, detail) {
  console.log((condition ? "PASS " : "FAIL ") + name + (condition || detail === undefined ? "" : "\n     " + JSON.stringify(detail).slice(0, 800)));
  if (!condition) failures++;
}
function note(text) {
  console.log("     " + text);
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class Gateway {
  constructor(base) {
    this.base = base;
    this.userId = "";
    this.accessToken = "";
  }
  async api(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.accessToken) headers.Authorization = "Bearer " + this.accessToken;
    if (this.userId) headers["New-Api-User"] = String(this.userId);
    const response = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: parse(await response.text()) };
  }
  async must(method, path, body) {
    const result = await this.api(method, path, body);
    if (result.status >= 300 || (result.body && result.body.success === false))
      throw new Error(this.base + ": " + method + " " + path + " failed: " + result.status + " " + JSON.stringify(result.body).slice(0, 500));
    return result.body;
  }
  async waitReady() {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(this.base + "/api/status")).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("server did not start at " + this.base);
  }
  async init() {
    await this.waitReady();
    const setup = await this.api("GET", "/api/setup");
    if (!(setup.body && setup.body.data && setup.body.data.status))
      await this.must("POST", "/api/setup", { username: ADMIN.username, password: ADMIN.password, confirmPassword: ADMIN.password });
    const login = await this.must("POST", "/api/user/login", ADMIN);
    this.userId = login.data.user ? login.data.user.id : login.data.id;
    this.accessToken = login.data.access_token || "";
    await this.must("POST", "/api/plugin/task", { source: readFileSync(PLUGIN_PATH, "utf8"), remark: "e2e" });
  }
  async addChannel(channel) {
    await this.must("POST", "/api/channel/", { mode: "single", channel: { group: "default", models: plugin.meta.models.join(","), ...channel } });
    const list = await this.must("GET", "/api/channel/?p=1&page_size=100");
    const items = list.data.items || list.data;
    return items.find((c) => c.name === channel.name).id;
  }
  async price(exprs) {
    const modes = Object.fromEntries(Object.keys(exprs).map((model) => [model, "tiered_expr"]));
    await this.must("PUT", "/api/option/", { key: "billing_setting.billing_expr", value: JSON.stringify(exprs) });
    await this.must("PUT", "/api/option/", { key: "billing_setting.billing_mode", value: JSON.stringify(modes) });
  }
  async issueToken(name) {
    await this.must("POST", "/api/token/", { name, remain_quota: 0, unlimited_quota: true, expired_time: -1 });
    const tokens = await this.must("GET", "/api/token/?p=1&size=50");
    const id = (tokens.data.items || tokens.data).find((t) => t.name === name).id;
    const key = await this.must("POST", "/api/token/" + id + "/key");
    return "sk-" + String(key.data.key).replace(/^sk-/, "");
  }
  async decide(token, body, path) {
    const response = await fetch(this.base + (path || "/v1/systemone"), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: parse(text), text };
  }
  async lastLog(model) {
    const logs = await this.must("GET", "/api/log/?p=1&page_size=50&type=2");
    return (logs.data.items || logs.data).find((item) => item.model_name === model);
  }
}

const PRICED = {
  "d1.1": suggested["d1.1"].by_input_tokens,
  "jev-1.14": suggested["jev-1.14"].by_input_tokens,
  "jev-latest": suggested["jev-latest"].by_input_tokens,
  "pplx-decider-v1.3:free": suggested["pplx-decider-v1.3:free"].by_input_tokens,
  "decisions-fast": suggested["decisions-fast"].by_input_tokens,
  "clef": suggested["clef"].by_upstream_cost,
};

const D11_REQUEST = {
  model: "d1.1",
  state: { zeta: "first member", alpha: "second member", ticket: "My checkout page is blank after I click Pay." },
  questions: {
    team: { type: "choice", instructions: "Which team owns this?", criteria: { payments: "Checkout issues", frontend: "Rendering", account: null } },
    is_bug: { type: "noul", instructions: "Is this a defect?", criteria: { true: "Broken behavior", false: "A question" } },
    urgency: { type: "score", instructions: "How urgent?", criteria: ["Later", "This week", "Now"] },
  },
};

async function testGatewayA(a, token, requests) {
  console.log("\n== Gateway A: Task Plugin (61) channel -> mock OpenRouter");
  let before = requests.length;
  let reply = await a.decide(token, D11_REQUEST);
  check("d1.1 returns 200", reply.status === 200, reply.body);
  check(
    "liquid/d1.1 returns choice, noul and score answers",
    reply.body.answers && reply.body.answers.team.type === "choice" && reply.body.answers.is_bug.type === "noul" && reply.body.answers.urgency.type === "score",
    reply.body,
  );
  check("d1.1 reply carries upstream usage and id", reply.body.usage && Number.isInteger(reply.body.usage.input_tokens) && reply.body.id, reply.body);
  check("d1.1 reply names the model d1.1", reply.body.model === "d1.1", reply.body.model);
  const sent = requests[before];
  const prefixed = await a.decide(token, D11_REQUEST, "/nyaasuki_decision/v1/systemone");
  check("the key-prefixed /nyaasuki_decision/v1/systemone answers the same way", prefixed.status === 200 && prefixed.body.answers && prefixed.body.answers.team.type === "choice", prefixed.body);
  // New API answers unknown paths with its web page, so the old path returns
  // HTML; what matters is that it no longer reaches the plugin.
  const beforeOld = requests.length;
  const oldPath = await a.decide(token, D11_REQUEST, "/decision/v1/systemone");
  check(
    "the old /decision/v1/systemone path no longer reaches the plugin",
    !(oldPath.body && oldPath.body.answers) && requests.length === beforeOld,
    { status: oldPath.status, body: String(oldPath.text || "").slice(0, 80) },
  );
  check("upstream receives POST /api/alpha/decisions", sent && sent.url === "/api/alpha/decisions", sent && sent.url);
  check("upstream receives the channel's OpenRouter key", sent && sent.headers.authorization === "Bearer " + MOCK_KEY);
  check(
    "upstream body carries the OpenRouter ID liquid/d1.1 and the client's state and questions",
    sent && sent.body.model === "liquid/d1.1" && JSON.stringify(sent.body.questions) === JSON.stringify(D11_REQUEST.questions),
    sent && sent.body,
  );
  check("upstream body keeps state member order", sent && sent.raw.indexOf('"zeta"') < sent.raw.indexOf('"alpha"'), sent && sent.raw);
  const d11Tokens = reply.body.usage.input_tokens;
  let log = await a.lastLog("d1.1");
  const d11Expected = Math.round(d11Tokens * 0.02 * QUOTA_PER_USD / 1e6);
  check("d1.1 settles on reported input tokens (" + d11Tokens + " tokens -> quota " + d11Expected + ")", log && Math.abs(log.quota - d11Expected) <= 1, log && log.quota);

  before = requests.length;
  reply = await a.decide(token, {
    model: "jev-1.14",
    state: ["Product photo:", { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } }],
    questions: {
      present: { type: "noul", instructions: "Is there a mug in the photo?" },
      product: { type: "box", instructions: "the mug in the product photo" },
    },
  });
  check(
    "jev-1.14 returns 200 with noul and box answers",
    reply.status === 200 && reply.body.answers.product.type === "box" && reply.body.answers.present.type === "noul",
    reply.body,
  );
  check("jev-1.14 forwards image_url parts unchanged", requests[before] && requests[before].body.state[1].type === "image_url");

  reply = await a.decide(token, { model: "jev-latest", state: "hello", questions: { q: { type: "noul" } } });
  check("jev-latest (OpenRouter ~typesafe/jev-latest) returns 200", reply.status === 200 && reply.body.answers.q.type === "noul", reply.body);
  check("jev-latest reaches OpenRouter as ~typesafe/jev-latest", requests[requests.length - 1].body.model === "~typesafe/jev-latest", requests[requests.length - 1].body.model);
  reply = await a.decide(token, { model: "pplx-decider-v1.3:free", state: "hello", questions: { ok: { type: "noul" }, refuse_me: { type: "noul" } } });
  check("perplexity :free variant returns 200 and passes a refusal answer through", reply.status === 200 && reply.body.answers.refuse_me.type === "refusal", reply.body);

  before = requests.length;
  reply = await a.decide(token, {
    model: "decisions-fast",
    state: "hello",
    questions: { q: { type: "noul" } },
    provider: { allow_fallbacks: false },
    session_id: "session-e2e",
    user: "user-e2e",
  });
  check(
    "provider, session_id and user reach OpenRouter",
    reply.status === 200 && requests[before] && requests[before].body.session_id === "session-e2e" && requests[before].body.provider.allow_fallbacks === false,
    reply.body,
  );
  log = await a.lastLog("decisions-fast");
  check("decisions-fast bills its 0.001 USD request fee (quota 500)", log && log.quota === 500, log && log.quota);

  reply = await a.decide(token, { model: "clef", state: "x".repeat(4000), questions: { q: { type: "noul" } } });
  check("clef billed by upstream_cost returns 200", reply.status === 200, reply.body);
  log = await a.lastLog("clef");
  const clefExpected = Math.round(reply.body.usage.cost * QUOTA_PER_USD);
  check("clef settles on usage.cost (" + reply.body.usage.cost + " USD -> quota " + clefExpected + ")", log && Math.abs(log.quota - clefExpected) <= 1, log && log.quota);

  before = requests.length;
  reply = await a.decide(token, { model: "clairic", state: "hello", questions: { q: { type: "noul" } } });
  check("Extractions-only clairic is rejected with 400", reply.status === 400, reply.body);
  note("error body: " + reply.text);
  reply = await a.decide(token, { model: "liquid/d1.1", state: "hello", questions: { q: { type: "noul" } } });
  check("the full OpenRouter ID liquid/d1.1 is not a New API model name (400)", reply.status === 400, reply.body);
  note("error body: " + reply.text);
  if (!plugin.meta.models.includes("d1")) {
    reply = await a.decide(token, { model: "d1", state: "hello", questions: { q: { type: "noul" } } });
    check("the retired d1 (liquid/d1) is rejected with 400", reply.status === 400, reply.body);
    note("error body: " + reply.text);
  }
  reply = await a.decide(token, { model: "openai/gpt-4o", state: "hello", questions: { q: { type: "noul" } } });
  check("a model not on the whitelist is rejected with 400", reply.status === 400, reply.body);
  note("error body: " + reply.text);
  check("rejected models never reach OpenRouter", requests.length === before);

  before = requests.length;
  reply = await a.decide(token, { model: "reflex", state: "hello", questions: { q: { type: "noul" } } });
  check("a whitelisted model without a price is refused before OpenRouter", reply.status >= 400 && requests.length === before, reply.body);
  note("status " + reply.status + " error body: " + reply.text);

  reply = await a.decide(token, { model: "d1.1", state: "hi", questions: { q: { type: "noul" } }, temperature: 0 });
  check("an unknown top-level field is rejected with 400", reply.status === 400, reply.body);
  note("error body: " + reply.text);
  reply = await a.decide(token, { model: "d1.1", state: "hi", questions: {} });
  check("empty questions are rejected with 400", reply.status === 400, reply.body);
  note("error body: " + reply.text);

  reply = await a.decide(token, { model: "d1.1", state: "hi", questions: { b: { type: "box", instructions: "the mug" } } });
  check("a box question on d1.1 returns OpenRouter's 400", reply.status === 400 && reply.body.error && /Box/.test(reply.body.error.message), reply.body);
  note("error body: " + reply.text);
  for (const [state, status] of [
    ["__insufficient_credits__", 402],
    ["__rate_limited__", 429],
    ["__provider_error__", 502],
  ]) {
    reply = await a.decide(token, { model: "d1.1", state, questions: { q: { type: "noul" } } });
    check("an upstream " + status + " reaches the client with status " + reply.status, reply.status === status && reply.body.error, reply.body);
    note("error body: " + reply.text);
  }
  reply = await a.decide(token, { model: "d1.1", state: "__terms_of_service__", questions: { q: { type: "noul" } } });
  check(
    "an upstream 403 reaches the client as only its error object, without OpenRouter's user_id",
    reply.status === 403 && reply.body.error && /Terms Of Service/.test(reply.body.error.message) && Object.keys(reply.body).join() === "error" && !reply.text.includes(MOCK_USER_ID),
    reply.body,
  );
  note("error body: " + reply.text);
}

async function testGatewayB(b, token) {
  console.log("\n== Gateway B: New API (60) channel -> gateway A");
  let reply = await b.decide(token, D11_REQUEST);
  check("d1.1 through a New API (60) upstream returns 200 with answers", reply.status === 200 && reply.body.answers && reply.body.answers.team.type === "choice", reply.body);
  const log = await b.lastLog("d1.1");
  check("gateway B settles on the usage gateway A returns", log && log.quota >= 0 && reply.body.usage, log);
  reply = await b.decide(token, { model: "d1.1", state: "hi", questions: { b: { type: "box", instructions: "the mug" } } });
  check("an OpenRouter 400 reaches the client through two gateways", reply.status === 400 && reply.body.error, reply.body);
  note("error body: " + reply.text);
}

async function testRealUpstream(a, token, mockChannelId) {
  console.log("\n== Gateway A: Task Plugin (61) channel with the default address -> https://openrouter.ai (dummy key)");
  await a.must("POST", "/api/channel/" + mockChannelId + "/status", { status: 2 });
  await a.addChannel({ type: 61, name: "openrouter-real", key: "sk-or-v1-invalid-e2e-key", base_url: "", setting: JSON.stringify({ task_plugin_key: "nyaasuki_decision" }) });
  const channels = await a.must("GET", "/api/channel/?p=1&page_size=100");
  const real = (channels.data.items || channels.data).find((c) => c.name === "openrouter-real");
  check("an empty channel address takes the plugin default https://openrouter.ai", real && real.base_url === "https://openrouter.ai", real && real.base_url);
  const reply = await a.decide(token, D11_REQUEST);
  check("OpenRouter's own 401 for the dummy key reaches the client", reply.status === 401 && reply.body.error, reply.body);
  note("status " + reply.status + " error body: " + reply.text);
}

async function main() {
  const { server: mock, requests } = await startMock(MOCK_PORT, catalog);
  try {
    const a = new Gateway(SERVER_A);
    await a.init();
    const installed = await a.must("GET", "/api/plugin/task/nyaasuki_decision");
    check("plugin installed as OpenRouter Decision " + plugin.meta.version, JSON.stringify(installed).includes("OpenRouter Decision") && JSON.stringify(installed).includes(plugin.meta.version), installed);
    const mockChannelId = await a.addChannel({
      type: 61,
      name: "openrouter-mock",
      key: MOCK_KEY,
      base_url: "http://127.0.0.1:" + MOCK_PORT,
      setting: JSON.stringify({ task_plugin_key: "nyaasuki_decision" }),
    });
    await a.price(PRICED);
    const tokenA = await a.issueToken("e2e");
    await testGatewayA(a, tokenA, requests);

    if (SERVER_B) {
      const b = new Gateway(SERVER_B);
      await b.init();
      await b.addChannel({
        type: 60,
        name: "gateway-a",
        key: tokenA,
        base_url: SERVER_A,
        setting: JSON.stringify({ task_extend_plugin_keys: ["nyaasuki_decision"] }),
      });
      await b.price(PRICED);
      await testGatewayB(b, await b.issueToken("e2e"));
    }
    if (REAL) await testRealUpstream(a, tokenA, mockChannelId);
  } finally {
    mock.close();
  }
  console.log(failures === 0 ? "\nAll checks passed" : "\n" + failures + " check(s) failed");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
