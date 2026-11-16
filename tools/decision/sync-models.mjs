#!/usr/bin/env node
// Syncs the OpenRouter Decision plugin with OpenRouter's official decision
// model catalog: its model whitelist, and the price feed New API's upstream
// price sync reads.
//
//   node tools/decision/sync-models.mjs --pricing  update the price feed only
//   node tools/decision/sync-models.mjs            also rewrite the catalog block
//                                                  in an unreleased plugin.js
//   node tools/decision/sync-models.mjs --check    report differences, exit 1 if
//                                                  the whitelist or the feed is stale
//
// Options:
//   --plugin <path>   plugin.js to read and update (default: newest version
//                     under plugins/tasks/nyaasuki_decision)
//   --from <url|file> catalog source (default: the official catalog JSON)
//   --date <date>     snapshot date (default: today, UTC)
//
// A model belongs on the whitelist when its catalog entry lists the endpoint
// /api/alpha/decisions. Entries served only by /api/alpha/extractions are left
// out. `:free` variants and `~` aliases are kept. In New API each model is
// named by its OpenRouter ID without the vendor prefix (liquid/d1.1 is d1.1);
// the plugin sends the full ID to OpenRouter.
//
// The price feed, pricing/nyaasuki_decision.json, has the format of New API's
// /api/ratio_config: a task usage expression for every model on the plugin's
// whitelist, at OpenRouter's list price. It lives outside the plugin, so prices
// change without a new plugin version. A whitelisted model that has left the
// catalog keeps its last known price.
//
// Also writes tools/decision/pricing.suggested.json (both expressions for each
// model) and, outside --pricing, tools/decision/models.snapshot.json.
//
// A plugin.js whose sha256 is in index.json is published and never rewritten:
// copy the version directory to a new version first.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE = "https://openrouter.ai/api/v1/models?output_modalities=decisions";
const DECISIONS_ENDPOINT = "/api/alpha/decisions";
const PLUGIN_KEY = "nyaasuki_decision";
const BEGIN = "// BEGIN GENERATED MODEL CATALOG";
const END = "// END GENERATED MODEL CATALOG";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const FEED_PATH = join(root, "pricing", PLUGIN_KEY + ".json");

function parseArgs(argv) {
  const args = { check: false, pricing: false, plugin: null, from: DEFAULT_SOURCE, date: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--pricing") args.pricing = true;
    else if (arg === "--plugin") args.plugin = argv[++i];
    else if (arg === "--from") args.from = argv[++i];
    else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 38).join("\n"));
      process.exit(0);
    } else throw new Error("Unknown argument " + arg);
  }
  return args;
}

function compareSemver(a, b) {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

function defaultPluginPath() {
  const dir = join(root, "plugins", "tasks", "nyaasuki_decision");
  const versions = readdirSync(dir).filter((name) => /^\d+\.\d+\.\d+/.test(name) && existsSync(join(dir, name, "plugin.js")));
  if (versions.length === 0) throw new Error("No plugin version found under " + dir);
  versions.sort(compareSemver);
  return join(dir, versions[versions.length - 1], "plugin.js");
}

async function loadJSON(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("GET " + source + " returned HTTP " + response.status);
    return { json: await response.json(), url: source };
  }
  return { json: JSON.parse(readFileSync(source, "utf8")), url: null };
}

// Follows links.next until the catalog is complete.
async function loadCatalog(source) {
  const entries = [];
  let next = source;
  const seen = new Set();
  while (next) {
    if (seen.has(next)) throw new Error("Catalog pagination loops at " + next);
    seen.add(next);
    const { json, url } = await loadJSON(next);
    if (!json || !Array.isArray(json.data)) throw new Error("Catalog response has no data array");
    entries.push(...json.data);
    const link = json.links && json.links.next;
    next = link && url ? new URL(link, url).toString() : null;
  }
  return entries;
}

function price(value, field, id) {
  if (value === undefined || value === null || value === "") return "0";
  const text = String(value);
  const number = Number(text);
  if (!/^\d+(\.\d+)?(e-?\d+)?$/i.test(text) || !Number.isFinite(number) || number < 0)
    throw new Error("Model " + id + " has an invalid " + field + " price " + JSON.stringify(value));
  return text;
}

function isDecisionModel(entry) {
  if (Array.isArray(entry.endpoints)) return entry.endpoints.includes(DECISIONS_ENDPOINT);
  // Older catalog responses have no endpoints list; fall back to the output
  // modality and say so.
  const outputs = (entry.architecture && entry.architecture.output_modalities) || [];
  if (outputs.includes("decisions")) {
    console.warn("warning: " + entry.id + " has no endpoints list; kept because it outputs decisions");
    return true;
  }
  return false;
}

function selectModels(entries) {
  const kept = [];
  const excluded = [];
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id) continue;
    if (ids.has(entry.id)) continue;
    ids.add(entry.id);
    if (!isDecisionModel(entry)) {
      excluded.push({ id: entry.id, endpoints: entry.endpoints || [] });
      continue;
    }
    const pricing = entry.pricing || {};
    kept.push({
      id: entry.id,
      name: entry.name || entry.id,
      canonical_slug: entry.canonical_slug || null,
      context: Number.isInteger(entry.context_length) && entry.context_length > 0 ? entry.context_length : 0,
      prompt: price(pricing.prompt, "prompt", entry.id),
      request: price(pricing.request, "request", entry.id),
      webSearch: price(pricing.web_search, "web_search", entry.id),
      input_modalities: (entry.architecture && entry.architecture.input_modalities) || [],
      expiration_date: entry.expiration_date || null,
    });
  }
  // New API names each model by its OpenRouter ID without the vendor prefix
  // and the ~ alias marker: liquid/d1.1 is d1.1, ~typesafe/jev-latest is
  // jev-latest. A short name two models would share keeps the full IDs.
  const counts = {};
  for (const model of kept) counts[shortName(model.id)] = (counts[shortName(model.id)] || 0) + 1;
  for (const model of kept) {
    const short = shortName(model.id);
    model.gateway_model = short && counts[short] === 1 ? short : model.id;
    if (model.gateway_model === model.id) console.warn("warning: " + model.id + " keeps its full ID because its short name is not unique");
  }
  kept.sort((a, b) => (a.gateway_model < b.gateway_model ? -1 : a.gateway_model > b.gateway_model ? 1 : 0));
  return { kept, excluded };
}

function shortName(id) {
  const slash = id.indexOf("/");
  return slash < 0 ? id.replace(/^~/, "") : id.slice(slash + 1);
}

function renderBlock(models, date, source) {
  const lines = [
    BEGIN,
    "// Written by tools/decision/sync-models.mjs from " + source + ".",
    "// Do not edit by hand; run tools/decision/sync-models.mjs and release a new version.",
    "// Keyed by the model name New API shows and bills. Each entry: the",
    "// OpenRouter model ID, context length in tokens, and OpenRouter list",
    "// prices in USD per input token, per request, and per web search.",
    'const CATALOG_SNAPSHOT = "' + date + '";',
    "const CATALOG = {",
  ];
  for (const model of models) {
    lines.push(
      "  " +
        JSON.stringify(model.gateway_model) +
        ": { id: " +
        JSON.stringify(model.id) +
        ", context: " +
        model.context +
        ", prompt: " +
        model.prompt +
        ", request: " +
        model.request +
        ", webSearch: " +
        model.webSearch +
        " },",
    );
  }
  lines.push("};", END);
  return lines.join("\n");
}

function readBlock(source) {
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start < 0 || end < start) throw new Error("plugin.js has no generated catalog block between " + BEGIN + " and " + END);
  return { start, end: end + END.length, text: source.slice(start, end + END.length) };
}

// The entries of a generated catalog block: name, OpenRouter ID and prices.
function blockEntries(text) {
  const entries = [];
  const pattern = /^\s{2}("(?:[^"\\]|\\.)*"): \{ id: ("(?:[^"\\]|\\.)*"), context: (\d+), prompt: ([^,]+), request: ([^,]+), webSearch: ([^ ]+) \},$/gm;
  let match;
  while ((match = pattern.exec(text)))
    entries.push({
      gateway_model: JSON.parse(match[1]),
      id: JSON.parse(match[2]),
      context: Number(match[3]),
      prompt: match[4],
      request: match[5],
      webSearch: match[6],
    });
  return entries;
}

function perMillion(value) {
  const number = Number(value) * 1e6;
  return String(Number(number.toPrecision(12)));
}

function tokenExpression(model) {
  const terms = [];
  if (Number(model.prompt) > 0) terms.push('u("input_tokens") * ' + perMillion(model.prompt) + " / 1000000");
  if (Number(model.request) > 0) terms.push(String(Number(model.request)));
  return 'tier("base", ' + (terms.length ? terms.join(" + ") : "0") + ")";
}

const COST_EXPRESSION = 'tier("base", u("upstream_cost"))';

// The feed prices a model at OpenRouter's list price per input token, plus its
// per-request fee. A model that also charges per web search is priced at the
// cost OpenRouter reports, since only that includes the searches.
function feedExpression(model) {
  return Number(model.webSearch) > 0 ? COST_EXPRESSION : tokenExpression(model);
}

function suggestedPricing(models) {
  const result = {};
  for (const model of models) {
    result[model.gateway_model] = {
      openrouter_id: model.id,
      by_input_tokens: tokenExpression(model),
      by_upstream_cost: COST_EXPRESSION,
      list_price: {
        input_per_million_usd: Number(perMillion(model.prompt)),
        per_request_usd: Number(model.request),
        per_web_search_usd: Number(model.webSearch),
      },
      note: Number(model.webSearch) > 0 ? "Web search is billed per search; only by_upstream_cost covers it." : undefined,
    };
  }
  return result;
}

function readFeed() {
  if (!existsSync(FEED_PATH)) return null;
  try {
    return JSON.parse(readFileSync(FEED_PATH, "utf8"));
  } catch (error) {
    throw new Error(FEED_PATH + " is not valid JSON: " + error.message);
  }
}

// The price feed in the format of New API's /api/ratio_config, keyed by the
// plugin's model names in whitelist order.
function buildFeed(names, current, previousFeed, fallback, date, source) {
  const modes = {};
  const expressions = {};
  const kept = [];
  const previous = (previousFeed && previousFeed.data && previousFeed.data.billing_expr) || {};
  for (const name of names) {
    let expression;
    if (current[name]) expression = feedExpression(current[name]);
    else if (typeof previous[name] === "string") expression = previous[name];
    else if (fallback[name]) expression = feedExpression(fallback[name]);
    else continue;
    if (!current[name]) kept.push(name);
    modes[name] = "tiered_expr";
    expressions[name] = expression;
  }
  const feed = {
    success: true,
    message: "",
    plugin: PLUGIN_KEY,
    snapshot: date,
    source: source,
    data: { billing_mode: modes, billing_expr: expressions },
  };
  return { feed, kept };
}

function feedPrices(feed) {
  return feed && feed.data ? JSON.stringify(feed.data) : "";
}

// A plugin.js whose bytes the marketplace index lists is published.
function isPublished(pluginPath) {
  const indexPath = join(root, "index.json");
  if (!existsSync(indexPath)) return false;
  const digest = createHash("sha256").update(readFileSync(pluginPath)).digest("hex");
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  return (index.plugins || []).some((plugin) => (plugin.versions || []).some((version) => version.sha256 === digest));
}

function writeFeed(feed) {
  mkdirSync(dirname(FEED_PATH), { recursive: true });
  writeFileSync(FEED_PATH, JSON.stringify(feed, null, 2) + "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pluginPath = resolve(args.plugin || defaultPluginPath());
  const entries = await loadCatalog(args.from);
  const { kept, excluded } = selectModels(entries);
  if (kept.length === 0) throw new Error("The catalog lists no decision models; refusing to empty the whitelist");

  const source = readFileSync(pluginPath, "utf8");
  const current = readBlock(source);
  const released = blockEntries(current.text);
  const before = released.map((entry) => entry.gateway_model);
  const after = kept.map((model) => model.gateway_model);
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  const sourceLabel = /^https?:\/\//.test(args.from) ? args.from : DEFAULT_SOURCE;
  const catalog = Object.fromEntries(kept.map((model) => [model.gateway_model, model]));
  const fallback = Object.fromEntries(released.map((entry) => [entry.gateway_model, entry]));
  const previousFeed = readFeed();

  console.log("catalog entries: " + entries.length + ", decision models: " + kept.length + ", excluded: " + excluded.length);
  for (const entry of excluded) console.log("  excluded " + entry.id + " (endpoints: " + (entry.endpoints.join(", ") || "none") + ")");
  for (const id of added) console.log("  + " + id + " (in the catalog, not yet in the plugin)");
  for (const id of removed) console.log("  - " + id + " (in the plugin, no longer in the catalog)");
  for (const model of kept) if (model.expiration_date) console.log("  ! " + model.id + " expires on " + model.expiration_date);

  if (args.check) {
    let stale = false;
    if (added.length || removed.length) {
      console.log("whitelist differs from the catalog: release a new plugin version (see README)");
      stale = true;
    } else console.log("whitelist matches the catalog");
    const fresh = buildFeed(before, catalog, previousFeed, fallback, args.date, sourceLabel).feed;
    if (feedPrices(fresh) !== feedPrices(previousFeed)) {
      console.log("price feed is stale: run node tools/decision/sync-models.mjs --pricing");
      stale = true;
    } else console.log("price feed matches the catalog");
    const strip = (text) => text.replace(/^const CATALOG_SNAPSHOT = .*$/m, "").replace(/^\/\/ Written by .*$/m, "");
    if (!added.length && !removed.length && strip(renderBlock(kept, args.date, sourceLabel)) !== strip(current.text))
      console.log("note: list prices changed since this plugin version; its quota reservations use the prices it was released with");
    process.exit(stale ? 1 : 0);
  }

  let whitelist = before;
  let priced = released.map((entry) => catalog[entry.gateway_model] || entry);
  if (!args.pricing) {
    if (isPublished(pluginPath))
      throw new Error(
        pluginPath +
          " is a published version and is never rewritten. Copy its directory to a new version and set meta.version, or use --pricing to update only the price feed",
      );
    writeFileSync(pluginPath, source.slice(0, current.start) + renderBlock(kept, args.date, sourceLabel) + source.slice(current.end));
    writeFileSync(
      join(here, "models.snapshot.json"),
      JSON.stringify({ snapshot: args.date, source: sourceLabel, endpoint: DECISIONS_ENDPOINT, models: kept, excluded }, null, 2) + "\n",
    );
    console.log("updated " + pluginPath);
    if (added.length || removed.length) console.log("The whitelist changed: release it as a new plugin version with a changelog.");
    whitelist = after;
    priced = kept;
  }

  const { feed, kept: lastKnown } = buildFeed(whitelist, catalog, previousFeed, fallback, args.date, sourceLabel);
  for (const name of lastKnown) console.log("  ~ " + name + " is not in the catalog; the feed keeps its last known price");
  if (previousFeed && feedPrices(feed) === feedPrices(previousFeed)) console.log("price feed unchanged: " + FEED_PATH);
  else {
    writeFeed(feed);
    console.log("updated " + FEED_PATH + " (" + Object.keys(feed.data.billing_expr).length + " models)");
  }
  // Rewrite the suggestions only when they change, so a run without price
  // changes leaves the repository as it was.
  const suggestedPath = join(here, "pricing.suggested.json");
  const suggested = JSON.parse(JSON.stringify(suggestedPricing(priced)));
  let previousSuggested = null;
  try {
    previousSuggested = JSON.parse(readFileSync(suggestedPath, "utf8")).models;
  } catch {}
  if (JSON.stringify(previousSuggested) !== JSON.stringify(suggested))
    writeFileSync(suggestedPath, JSON.stringify({ snapshot: args.date, plugin: PLUGIN_KEY, models: suggested }, null, 2) + "\n");
}

main().catch((error) => {
  console.error("sync-models: " + error.message);
  process.exit(2);
});
