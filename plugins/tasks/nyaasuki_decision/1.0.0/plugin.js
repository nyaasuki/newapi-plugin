// OpenRouter Decisions API:
// https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request
// One plugin for every OpenRouter decision model. Clients choose a model with
// the `model` field, by its New API name (d1.1 for liquid/d1.1); the plugin
// forwards the request to POST /api/alpha/decisions with the OpenRouter ID
// and returns OpenRouter's reply, with the model named as the client called it.

// BEGIN GENERATED MODEL CATALOG
// Written by tools/decision/sync-models.mjs from https://openrouter.ai/api/v1/models?output_modalities=decisions.
// Do not edit by hand; run tools/decision/sync-models.mjs and release a new version.
// Keyed by the model name New API shows and bills. Each entry: the
// OpenRouter model ID, context length in tokens, and OpenRouter list
// prices in USD per input token, per request, and per web search.
const CATALOG_SNAPSHOT = "2026-11-16";
const CATALOG = {
  "classify-1": { id: "scaledown/classify-1", context: 1000000, prompt: 0.00000004, request: 0, webSearch: 0 },
  "clef": { id: "cloudflare/clef", context: 65537, prompt: 0.000000192, request: 0, webSearch: 0 },
  "clef-flash": { id: "cloudflare/clef-flash", context: 24576, prompt: 0.000000019, request: 0, webSearch: 0 },
  "clef-omni": { id: "cloudflare/clef-omni", context: 65536, prompt: 0.00000015, request: 0, webSearch: 0 },
  "d1": { id: "liquid/d1", context: 65536, prompt: 0.00000002, request: 0, webSearch: 0 },
  "d1-latest": { id: "~liquid/d1-latest", context: 65536, prompt: 0.00000002, request: 0, webSearch: 0 },
  "d1-ultra": { id: "liquid/d1-ultra", context: 32768, prompt: 0.000000042, request: 0, webSearch: 0 },
  "d1-ultra-latest": { id: "~liquid/d1-ultra-latest", context: 32768, prompt: 0.000000042, request: 0, webSearch: 0 },
  "d1.1": { id: "liquid/d1.1", context: 65536, prompt: 0.00000002, request: 0, webSearch: 0 },
  "decisions-fast": { id: "parallel/decisions-fast", context: 32000, prompt: 0, request: 0.001, webSearch: 0 },
  "drex-max": { id: "nace-ai/drex-max", context: 262144, prompt: 0.00000006, request: 0, webSearch: 0 },
  "drex-max-finance": { id: "nace-ai/drex-max-finance", context: 262144, prompt: 0.00000006, request: 0, webSearch: 0 },
  "drex-v1.5": { id: "nace-ai/drex-v1.5", context: 131072, prompt: 0.00000004, request: 0, webSearch: 0 },
  "drex-v2.0": { id: "nace-ai/drex-v2.0", context: 131072, prompt: 0.00000006, request: 0, webSearch: 0 },
  "elephant-1": { id: "baseten/elephant-1", context: 16384, prompt: 0.000000035, request: 0, webSearch: 0 },
  "gemini-decision-1": { id: "google/gemini-decision-1", context: 262144, prompt: 0.0000001, request: 0, webSearch: 0.014 },
  "gpt-6-luna-decisions": { id: "openai/gpt-6-luna-decisions", context: 1050000, prompt: 0.0000001, request: 0, webSearch: 0.01 },
  "heygen-decision-1": { id: "heygen/heygen-decision-1", context: 131072, prompt: 0.00000014, request: 0, webSearch: 0 },
  "heygen-decision-1-turbo": { id: "heygen/heygen-decision-1-turbo", context: 262144, prompt: 0.00000009, request: 0, webSearch: 0 },
  "jev-1.13": { id: "typesafe/jev-1.13", context: 262144, prompt: 0.000000042, request: 0, webSearch: 0 },
  "jev-1.14": { id: "typesafe/jev-1.14", context: 262144, prompt: 0.000000042, request: 0, webSearch: 0 },
  "jev-latest": { id: "~typesafe/jev-latest", context: 262144, prompt: 0.000000042, request: 0, webSearch: 0 },
  "joey-1": { id: "baseten/joey-1", context: 16384, prompt: 0.00000001, request: 0, webSearch: 0 },
  "kev-4b": { id: "jaredpalmer/kev-4b", context: 8192, prompt: 0.000000042, request: 0, webSearch: 0 },
  "mammoth-1": { id: "baseten/mammoth-1", context: 16384, prompt: 0.0000001, request: 0, webSearch: 0 },
  "microsoft-decision-1": { id: "microsoft/microsoft-decision-1", context: 32768, prompt: 0.000000042, request: 0, webSearch: 0 },
  "pplx-decider-flash-latest": { id: "~perplexity/pplx-decider-flash-latest", context: 262144, prompt: 0.00000001, request: 0, webSearch: 0 },
  "pplx-decider-flash-v1.2": { id: "perplexity/pplx-decider-flash-v1.2", context: 262144, prompt: 0.00000001, request: 0, webSearch: 0 },
  "pplx-decider-flash-v1.3:free": { id: "perplexity/pplx-decider-flash-v1.3:free", context: 262144, prompt: 0, request: 0, webSearch: 0 },
  "pplx-decider-latest": { id: "~perplexity/pplx-decider-latest", context: 262144, prompt: 0.00000002, request: 0, webSearch: 0 },
  "pplx-decider-v1.2": { id: "perplexity/pplx-decider-v1.2", context: 262144, prompt: 0.00000002, request: 0, webSearch: 0 },
  "pplx-decider-v1.3:free": { id: "perplexity/pplx-decider-v1.3:free", context: 262144, prompt: 0, request: 0, webSearch: 0 },
  "reflex": { id: "morph/reflex", context: 65536, prompt: 0.000000042, request: 0, webSearch: 0 },
  "solar-decide": { id: "upstage/solar-decide", context: 524288, prompt: 0.00000005, request: 0, webSearch: 0 },
  "solar-decide-flash": { id: "upstage/solar-decide-flash", context: 524288, prompt: 0.00000005, request: 0, webSearch: 0 },
  "span-01": { id: "respan/span-01", context: 0, prompt: 0.00000002, request: 0, webSearch: 0 },
  "span-01-lite": { id: "respan/span-01-lite", context: 0, prompt: 0, request: 0, webSearch: 0 },
  "span-01-lite:free": { id: "respan/span-01-lite:free", context: 0, prompt: 0, request: 0, webSearch: 0 },
  "span-02": { id: "respan/span-02", context: 131072, prompt: 0.00000001, request: 0, webSearch: 0 },
  "tev1-4b-experimental": { id: "togethercomputer/tev1-4b-experimental", context: 32768, prompt: 0.000000042, request: 0, webSearch: 0 },
};
// END GENERATED MODEL CATALOG

const MODELS = Object.keys(CATALOG);
const UPSTREAM_PATH = "/api/alpha/decisions";
const NATIVE_PATH = "/decision/v1/systemone";
// Two respan models list a context length of 0 in the catalog. Reserve for
// the largest common decision context instead; completion settles on the
// tokens OpenRouter reports.
const FALLBACK_CONTEXT_TOKENS = 262144;
// The top-level members of OpenRouter's DecisionsRequest.
const REQUEST_FIELDS = ["model", "state", "questions", "assets", "provider", "session_id", "trace", "user"];

const USAGE_SCHEMA = {
  input_tokens: {
    type: "number",
    unit: "token",
    description: { en: "Input token unit price", zh: "输入 token 单价" },
  },
  upstream_cost: {
    type: "number",
    unit: "credit",
    description: {
      en: "Price per USD of OpenRouter cost (usage.cost)",
      zh: "每 1 美元 OpenRouter 费用（usage.cost）的价格",
    },
  },
};

export const meta = {
  apiVersion: 1,
  key: "nyaasuki_decision",
  name: "OpenRouter Decision",
  sortPriority: 80,
  version: "1.0.0",
  icon: "OpenRouter",
  author: { name: "nyaasuki", url: "https://github.com/nyaasuki/newapi-plugin" },
  website: "https://openrouter.ai/models?output_modalities=decisions",
  description: {
    en: "Typed decisions from every OpenRouter decision model, chosen by model",
    zh: "通过 OpenRouter 调用全部决策模型，按 model 切换，返回结构化判断",
  },
  baseUrl: "https://openrouter.ai",
  auth: "api_key",
  models: MODELS,
  upstreams: ["vendor", "new_api"],
  // Jev and other decision models read the state object as written, so member
  // order changes their answers; the host keeps the client's order only for
  // plugins that ask.
  requiredCapabilities: ["json-order@1"],
  fetchMode: "per_task",
  routes: [
    {
      method: "POST",
      path: NATIVE_PATH,
      type: "submit",
      decode: "decodeDecision",
      render: "renderDecision",
      retainResult: false,
      // The host rejects a model outside the whitelist with 400 before any
      // hook runs. Channel aliases of a listed model still pass.
      models: MODELS,
    },
  ],
  usageSchema: USAGE_SCHEMA,
  usageExamples: [
    { label: "d1.1 · 1k tokens", facts: { input_tokens: 1000, upstream_cost: 0.00002 } },
    { label: "jev-1.14 · 1k tokens", facts: { input_tokens: 1000, upstream_cost: 0.000042 } },
  ],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value) {
  return typeof value === "string" || typeof value === "object";
}

// Validates the envelope only. Question types, media parts and model-specific
// state shapes are the upstream model's to accept or reject.
function validateRequest(body) {
  if (!isObject(body)) throw new Error("Request body must be a JSON object");
  for (const field of Object.keys(body)) {
    if (!REQUEST_FIELDS.includes(field))
      throw new Error("The Decisions API does not accept the request field " + field + "; use " + REQUEST_FIELDS.join(", "));
  }
  if (typeof body.model !== "string" || !body.model.trim()) throw new Error("model is required");
  if (body.state === undefined || body.state === null || !isText(body.state))
    throw new Error("state is required and must be text, an object, or an array");
  if (!isObject(body.questions) || Object.keys(body.questions).length === 0)
    throw new Error("questions must be a nonempty object keyed by question ID");
  for (const id of Object.keys(body.questions)) {
    const question = body.questions[id];
    if (!isObject(question) || typeof question.type !== "string" || !question.type)
      throw new Error("Question " + id + " must be an object with a type such as choice, noul, or score");
  }
  if (body.assets !== undefined && !isObject(body.assets)) throw new Error("assets must be an object keyed by reference");
  return body;
}

// The body OpenRouter receives: the client's members in the client's order,
// with the model replaced by the channel's upstream model.
function decisionBody(body, model) {
  const request = {};
  for (const field of Object.keys(body)) {
    if (body[field] !== undefined) request[field] = field === "model" ? model : body[field];
  }
  return request;
}

// The catalog entry for the model the channel executes: a New API model name
// such as d1.1, or a full OpenRouter ID such as liquid/d1.1 that a channel
// mapping points to.
function findModel(ctx) {
  const model = ctx.upstreamModel || ctx.model;
  if (Object.prototype.hasOwnProperty.call(CATALOG, model)) return { name: model, entry: CATALOG[model] };
  for (const name of MODELS) {
    if (CATALOG[name].id === model) return { name: name, entry: CATALOG[name] };
  }
  return null;
}

function requireModel(ctx) {
  const found = findModel(ctx);
  if (!found)
    throw new Error(
      "Unsupported decision model " + (ctx.upstreamModel || ctx.model) + "; use a model from the OpenRouter Decision plugin whitelist or map an alias to one",
    );
  return found;
}

// OpenRouter takes the full model ID. Another New API gateway takes the
// plugin's own model name, as its clients do.
function decisionRequest(ctx) {
  const body = validateRequest(ctx.requestBody);
  const found = requireModel(ctx);
  return decisionBody(body, ctx.upstream && ctx.upstream.kind === "new_api" ? found.name : found.entry.id);
}

function contextTokens(entry) {
  return entry.context > 0 ? entry.context : FALLBACK_CONTEXT_TOKENS;
}

// What OpenRouter would charge from its list prices, used when a reply carries
// no usage.cost.
function listCost(entry, inputTokens, webSearches) {
  return inputTokens * entry.prompt + entry.request + webSearches * entry.webSearch;
}

function roundCost(value) {
  return Math.round(value * 1e12) / 1e12;
}

export function buildSubmitRequest(ctx) {
  const body = decisionRequest(ctx);
  let baseUrl = ctx.baseUrl.replace(/\/+$/, "");
  // Accept channel addresses copied from the OpenRouter docs.
  baseUrl = baseUrl.replace(/\/api\/alpha\/decisions$/, "").replace(/\/api\/v1$/, "").replace(/\/api$/, "");
  const path = ctx.upstream && ctx.upstream.kind === "new_api" ? NATIVE_PATH : UPSTREAM_PATH;
  return {
    url: baseUrl + path,
    method: "POST",
    headers: {
      Authorization: "Bearer " + ctx.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body,
  };
}

export function parseSubmitResponse(ctx, response) {
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error("OpenRouter returned HTTP " + response.statusCode);
  const body = response.body;
  // OpenRouter has charged for the request once it answers 2xx, so the reply
  // is passed on as long as it has answers. An answer can be a refusal, and
  // its shape is the model's own.
  if (!isObject(body) || !isObject(body.answers)) throw new Error("OpenRouter response is missing answers");
  if (!ctx.publicTaskId) throw new Error("Missing gateway request ID");
  // The reply names the model as the client called it, such as d1.1.
  const data = {};
  for (const field of Object.keys(body)) data[field] = field === "model" ? ctx.model : body[field];
  if (data.model === undefined) data.model = ctx.model;
  return {
    taskId: ctx.publicTaskId,
    taskData: data,
    immediate: { status: "SUCCESS", progress: "100%" },
  };
}

// Reserves the model's full context at list price; completion settles on the
// usage OpenRouter reports.
export function extractUsage(ctx) {
  const entry = requireModel(ctx).entry;
  validateRequest(ctx.requestBody);
  if (ctx.usagePurpose === "billing_ratios") return null;
  const tokens = contextTokens(entry);
  return { input_tokens: tokens, upstream_cost: roundCost(listCost(entry, tokens, entry.webSearch > 0 ? 1 : 0)) };
}

export function extractUsageOnComplete(ctx, result, body) {
  const usage = body && body.usage;
  const tokens = usage && usage.input_tokens;
  // Throwing keeps the reservation and makes the host log invalid usage.
  // Never coerce missing usage to zero.
  if (!Number.isInteger(tokens) || tokens < 0) throw new Error("OpenRouter input token usage is missing or invalid");
  let cost = usage.cost;
  if (typeof cost !== "number" || !isFinite(cost) || cost < 0) {
    const found = findModel(ctx);
    if (!found) throw new Error("OpenRouter cost is missing and the model has no list price");
    cost = listCost(found.entry, tokens, 0);
  }
  return { input_tokens: tokens, upstream_cost: roundCost(cost) };
}

// API v1 requires polling hooks, but the Decisions API always answers in the
// same response.
export function buildQueryRequest() {
  throw new Error("The OpenRouter Decisions API has no task retrieval endpoint");
}

export function parseTaskResult() {
  return { status: "UNKNOWN", reason: "The OpenRouter Decisions API has no asynchronous tasks" };
}

export const native = {
  decodeDecision: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = validateRequest(ctx.body.value);
    return {
      kind: "submit",
      model: body.model,
      action: "decision",
      requestBody: decisionBody(body, body.model),
    };
  },
  renderDecision: function (ctx, task) {
    return task.data;
  },
  // Errors reach the client in OpenRouter's shape, {error: {code, message}}.
  error: function (ctx, error) {
    try {
      const body = JSON.parse(error.message);
      if (isObject(body) && isObject(body.error)) return body;
    } catch (parseError) {
      // Gateway errors are sentences, not OpenRouter JSON.
    }
    return { error: { code: error.httpStatus, message: error.message, type: error.code } };
  },
};
