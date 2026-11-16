#!/usr/bin/env node
// Syncs the OpenRouter Decision plugin's model whitelist with OpenRouter's
// official decision model catalog.
//
//   node tools/decision/sync-models.mjs            rewrite the catalog block in plugin.js
//   node tools/decision/sync-models.mjs --check    report differences, exit 1 if any
//
// Options:
//   --plugin <path>   plugin.js to update (default: newest version under
//                     plugins/tasks/nyaasuki_decision)
//   --from <url|file> catalog source (default: the official catalog JSON)
//   --date <date>     snapshot date written into the block (default: today, UTC)
//
// A model belongs on the whitelist when its catalog entry lists the endpoint
// /api/alpha/decisions. Entries served only by /api/alpha/extractions are left
// out. `:free` variants and `~` aliases are kept. In New API each model is
// named by its OpenRouter ID without the vendor prefix (liquid/d1.1 is d1.1);
// the plugin sends the full ID to OpenRouter.
//
// Also writes tools/decision/models.snapshot.json (the catalog subset used) and
// tools/decision/pricing.suggested.json (billing expressions from list prices).

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE = "https://openrouter.ai/api/v1/models?output_modalities=decisions";
const DECISIONS_ENDPOINT = "/api/alpha/decisions";
const BEGIN = "// BEGIN GENERATED MODEL CATALOG";
const END = "// END GENERATED MODEL CATALOG";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

function parseArgs(argv) {
  const args = { check: false, plugin: null, from: DEFAULT_SOURCE, date: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--plugin") args.plugin = argv[++i];
    else if (arg === "--from") args.from = argv[++i];
    else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 20).join("\n"));
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

function blockModels(text) {
  const ids = [];
  const pattern = /^\s{2}("(?:[^"\\]|\\.)*"): \{/gm;
  let match;
  while ((match = pattern.exec(text))) ids.push(JSON.parse(match[1]));
  return ids;
}

function perMillion(value) {
  const number = Number(value) * 1e6;
  return String(Number(number.toPrecision(12)));
}

function suggestedPricing(models) {
  const result = {};
  for (const model of models) {
    const terms = [];
    if (Number(model.prompt) > 0) terms.push('u("input_tokens") * ' + perMillion(model.prompt) + " / 1000000");
    if (Number(model.request) > 0) terms.push(String(Number(model.request)));
    const byTokens = 'tier("base", ' + (terms.length ? terms.join(" + ") : "0") + ")";
    result[model.gateway_model] = {
      openrouter_id: model.id,
      by_input_tokens: byTokens,
      by_upstream_cost: 'tier("base", u("upstream_cost"))',
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pluginPath = resolve(args.plugin || defaultPluginPath());
  const entries = await loadCatalog(args.from);
  const { kept, excluded } = selectModels(entries);
  if (kept.length === 0) throw new Error("The catalog lists no decision models; refusing to empty the whitelist");

  const source = readFileSync(pluginPath, "utf8");
  const current = readBlock(source);
  const before = blockModels(current.text);
  const after = kept.map((model) => model.gateway_model);
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  const sourceLabel = /^https?:\/\//.test(args.from) ? args.from : DEFAULT_SOURCE;

  console.log("catalog entries: " + entries.length + ", decision models: " + kept.length + ", excluded: " + excluded.length);
  for (const entry of excluded) console.log("  excluded " + entry.id + " (endpoints: " + (entry.endpoints.join(", ") || "none") + ")");
  for (const id of added) console.log("  + " + id);
  for (const id of removed) console.log("  - " + id);
  for (const model of kept) if (model.expiration_date) console.log("  ! " + model.id + " expires on " + model.expiration_date);

  if (args.check) {
    // Compare everything except the snapshot date.
    const strip = (text) => text.replace(/^const CATALOG_SNAPSHOT = .*$/m, "").replace(/^\/\/ Written by .*$/m, "");
    const fresh = renderBlock(kept, args.date, sourceLabel);
    if (strip(fresh) !== strip(current.text)) {
      console.log("whitelist or prices differ from the catalog: run node tools/decision/sync-models.mjs and release a new version");
      process.exit(1);
    }
    console.log("whitelist matches the catalog");
    return;
  }

  const block = renderBlock(kept, args.date, sourceLabel);
  writeFileSync(pluginPath, source.slice(0, current.start) + block + source.slice(current.end));
  writeFileSync(
    join(here, "models.snapshot.json"),
    JSON.stringify({ snapshot: args.date, source: sourceLabel, endpoint: DECISIONS_ENDPOINT, models: kept, excluded }, null, 2) + "\n",
  );
  writeFileSync(join(here, "pricing.suggested.json"), JSON.stringify({ snapshot: args.date, plugin: "nyaasuki_decision", models: suggestedPricing(kept) }, null, 2) + "\n");
  console.log("updated " + pluginPath);
  if (added.length || removed.length) console.log("The whitelist changed: release it as a new plugin version with a changelog.");
}

main().catch((error) => {
  console.error("sync-models: " + error.message);
  process.exit(2);
});
