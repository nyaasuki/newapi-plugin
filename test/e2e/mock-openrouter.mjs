// A local stand-in for POST https://openrouter.ai/api/alpha/decisions, used by
// the end-to-end test. It answers in OpenRouter's documented response shape
// and records every request it receives.
import { createServer } from "node:http";

export const MOCK_KEY = "sk-or-e2e-mock-key";
const BOX_MODELS = ["typesafe/jev-1.14", "~typesafe/jev-latest"];

function answerFor(question, id, model) {
  if (model.startsWith("perplexity/") && id === "refuse_me") return { type: "refusal" };
  switch (question.type) {
    case "noul":
      return { type: "noul", noul: 0.91, confidence: 0.82 };
    case "choice": {
      const keys = Object.keys(question.criteria || {});
      const probabilities = Object.fromEntries(keys.map((key, index) => [key, index === 0 ? 0.8 : 0.2 / Math.max(1, keys.length - 1)]));
      return { type: "choice", choice: keys[0], confidence: 0.8, probabilities };
    }
    case "score": {
      const levels = question.criteria || [];
      const legend = Object.fromEntries(levels.map((level, index) => [String(index), level]));
      const probabilities = Object.fromEntries(levels.map((_, index) => [String(index), index === levels.length - 1 ? 1 : 0]));
      return { type: "score", score: levels.length - 1, confidence: 0.99, legend, probabilities };
    }
    case "box":
      return { type: "box", box: { top: 0.1, bottom: 0.9, left: 0.2, right: 0.8 }, confidence: 0.93 };
    default:
      return null;
  }
}

export function startMock(port, catalog) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const record = { method: req.method, url: req.url, headers: req.headers, raw };
      requests.push(record);
      const send = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.method !== "POST" || req.url !== "/api/alpha/decisions") return send(404, { error: { code: 404, message: "Not Found" } });
      if (req.headers.authorization !== "Bearer " + MOCK_KEY) return send(401, { error: { code: 401, message: "Missing Authentication header" } });
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { error: { code: 400, message: "Invalid JSON" } });
      }
      record.body = body;
      const entry = catalog[body.model];
      if (!entry) return send(400, { error: { code: 400, message: body.model + " is not a valid model ID" } });
      if (body.state === "__rate_limited__") return send(429, { error: { code: 429, message: "Rate limit exceeded" } });
      if (body.state === "__provider_error__") return send(502, { error: { code: 502, message: "Provider returned error" } });
      if (body.state === "__insufficient_credits__")
        return send(402, { error: { code: 402, message: "Insufficient credits. Add more using https://openrouter.ai/credits" } });
      const answers = {};
      for (const [id, question] of Object.entries(body.questions)) {
        if (question.type === "box" && !BOX_MODELS.includes(body.model))
          return send(400, { error: { code: 400, message: "Box questions are served by TypeSafe Jev endpoints only" } });
        const answer = answerFor(question, id, body.model);
        if (!answer) return send(400, { error: { code: 400, message: "Unknown question type " + question.type } });
        answers[id] = answer;
      }
      const inputTokens = Math.ceil(raw.length / 4);
      const cost = inputTokens * entry.prompt + entry.request;
      send(200, {
        id: "gen-dec-e2e-" + requests.length,
        model: body.model.replace(/^~/, "") + "-20261116",
        provider: "Mock",
        answers,
        usage: { input_tokens: inputTokens, output_tokens: 12, cost },
      });
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, requests })));
}
