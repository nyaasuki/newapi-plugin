// Installs every plugin in index.json from this repository, served as a
// marketplace source, into a fresh New API, the way the marketplace install
// dialog does: it fetches index.json, each plugin's latest plugin.js, README
// and CHANGELOG over HTTP, checks every sha256 from the index, and uploads the
// source with marketplaceIndexUrl, so the gateway applies its third-party key
// rules.
//
//   node test/marketplace/install.mjs --server http://127.0.0.1:13000 [--port 18090]
//
// The server must be a fresh install (the script runs its initial setup) or
// use the e2e admin account.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf("--" + name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const SERVER = option("server", "http://127.0.0.1:13000").replace(/\/+$/, "");
const PORT = Number(option("port", 18090));
const INDEX_URL = "http://127.0.0.1:" + PORT + "/index.json";
const ADMIN = { username: "e2eroot", password: "E2e-Test-Pass-2026" };

let failures = 0;
function check(name, condition, detail) {
  console.log((condition ? "PASS " : "FAIL ") + name + (condition || detail === undefined ? "" : "\n     " + JSON.stringify(detail).slice(0, 600)));
  if (!condition) failures++;
}
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// A static file server for the repository, with the CORS header GitHub raw
// sends, since the dashboard fetches marketplace files from the browser.
function serveRepository() {
  const server = createServer(async (req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(root + sep)) return res.writeHead(403).end();
    try {
      const body = await readFile(path);
      res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", () => resolveServer(server)));
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("GET " + url + " returned " + response.status);
  return Buffer.from(await response.arrayBuffer());
}

let accessToken = "";
let userId = "";
async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = "Bearer " + accessToken;
  if (userId) headers["New-Api-User"] = String(userId);
  const response = await fetch(SERVER + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

async function login() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(SERVER + "/api/status")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const setup = await api("GET", "/api/setup");
  if (!(setup.body && setup.body.data && setup.body.data.status))
    await api("POST", "/api/setup", { username: ADMIN.username, password: ADMIN.password, confirmPassword: ADMIN.password });
  const result = await api("POST", "/api/user/login", ADMIN);
  if (!result.body.success) throw new Error("login failed: " + JSON.stringify(result.body));
  accessToken = result.body.data.access_token;
  userId = result.body.data.user.id;
}

async function main() {
  const fileServer = await serveRepository();
  try {
    await login();
    const sources = await api("GET", "/api/plugin/task/marketplace/sources");
    const list = (sources.body.data || []).filter((source) => source.index_url !== INDEX_URL);
    list.push({ name: "newapi-plugin (local)", index_url: INDEX_URL });
    const saved = await api("PUT", "/api/plugin/task/marketplace/sources", list);
    check("the repository is accepted as a marketplace source", saved.body.success, saved.body);

    const indexBytes = await fetchBytes(INDEX_URL);
    const index = JSON.parse(indexBytes.toString("utf8"));
    check("index.json is a v1 marketplace index with plugins", index.indexVersion === 1 && index.plugins.length > 0, index.indexVersion);

    for (const plugin of index.plugins) {
      const entry = plugin.versions.find((version) => version.version === plugin.latest);
      const source = await fetchBytes(new URL(entry.path, INDEX_URL).href);
      check(plugin.key + "@" + entry.version + " plugin.js matches its index sha256", sha256(source) === entry.sha256);
      for (const doc of [entry.readme, entry.changelog]) {
        if (!doc) continue;
        for (const file of [doc, ...Object.values(doc.translations || {})]) {
          const bytes = await fetchBytes(new URL(file.path, INDEX_URL).href);
          check(plugin.key + " " + file.path + " matches its index sha256", sha256(bytes) === file.sha256);
        }
      }
      check(plugin.key + " has a usage guide and release notes in the index", Boolean(entry.readme && entry.changelog), entry);

      const installed = await api("POST", "/api/plugin/task", {
        source: source.toString("utf8"),
        sourceSha256: entry.sha256,
        enabled: true,
        remark: "marketplace install test",
        marketplaceIndexUrl: INDEX_URL,
      });
      check(plugin.key + "@" + entry.version + " installs from the marketplace source", installed.body.success, installed.body);
      const detail = await api("GET", "/api/plugin/task/" + plugin.key);
      check(plugin.key + " is listed as installed and enabled", detail.body.success && JSON.stringify(detail.body).includes(entry.version), detail.body);
    }
  } finally {
    fileServer.close();
  }
  console.log(failures === 0 ? "\nAll checks passed" : "\n" + failures + " check(s) failed");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
