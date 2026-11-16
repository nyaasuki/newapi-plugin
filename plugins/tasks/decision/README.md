---
translations:
  zh-CN: README.zh-CN.md
---
# OpenRouter Decision

Answers typed questions about text, data or media with any decision model on OpenRouter, such as Jev, Liquid d1.1, Cloudflare Clef or Perplexity Decider. Clients switch models by changing `model` in the request body. The answers come back in the same response.

## Channel setup

- Choose the Task Plugin (61) channel type and bind the OpenRouter Decision plugin.
- The key is an OpenRouter API key. See the [Decisions API reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request).
- Leave the API address empty to use `https://openrouter.ai`. An address ending in `/api` or `/api/v1` also works.
- Add the models you want to offer to the channel. Model permissions and groups work as on any other channel.
- To use another New API gateway as the upstream, choose New API (60) and enter that gateway's address and one of its tokens. That gateway needs the OpenRouter Decision plugin too.

## Models and endpoints

| Endpoint | What it does |
| --- | --- |
| `POST /decision/v1/systemone` | Sends a Decisions request to OpenRouter and returns its answers and usage. |

The plugin serves the 40 models that OpenRouter's catalog listed for the Decisions API on 2026-11-16:

- Baseten: `baseten/elephant-1`, `baseten/joey-1`, `baseten/mammoth-1`
- Cloudflare: `cloudflare/clef`, `cloudflare/clef-flash`, `cloudflare/clef-omni`
- Google: `google/gemini-decision-1`
- HeyGen: `heygen/heygen-decision-1`, `heygen/heygen-decision-1-turbo`
- Jared Palmer: `jaredpalmer/kev-4b`
- Liquid AI: `liquid/d1`, `liquid/d1-ultra`, `liquid/d1.1`, `~liquid/d1-latest`, `~liquid/d1-ultra-latest`
- Microsoft: `microsoft/microsoft-decision-1`
- Morph: `morph/reflex`
- Nace.AI: `nace-ai/drex-max`, `nace-ai/drex-max-finance`, `nace-ai/drex-v1.5`, `nace-ai/drex-v2.0`
- OpenAI: `openai/gpt-6-luna-decisions`
- Parallel: `parallel/decisions-fast`
- Perplexity: `perplexity/pplx-decider-v1.2`, `perplexity/pplx-decider-flash-v1.2`, `perplexity/pplx-decider-v1.3:free`, `perplexity/pplx-decider-flash-v1.3:free`, `~perplexity/pplx-decider-latest`, `~perplexity/pplx-decider-flash-latest`
- Respan: `respan/span-01`, `respan/span-01-lite`, `respan/span-01-lite:free`, `respan/span-02`
- ScaleDown: `scaledown/classify-1`
- Together: `togethercomputer/tev1-4b-experimental`
- TypeSafe: `typesafe/jev-1.13`, `typesafe/jev-1.14`, `~typesafe/jev-latest`
- Upstage: `upstage/solar-decide`, `upstage/solar-decide-flash`

`cloudflare/clairic` is in the catalog but serves only the Extractions API, so the plugin leaves it out. OpenRouter lists `liquid/d1` as expiring on 2026-11-20.
A model outside this list gets a 400 error from the gateway and never reaches OpenRouter.

Questions use the types `choice`, `noul` and `score`. Jev also answers `box`. Which question types, media parts and `state` shapes a model accepts is up to that model; OpenRouter answers anything else with a 400.
Errors reach the client as `{"error": {"code", "message"}}`, as OpenRouter writes them. A 4xx error from OpenRouter keeps its status and message. A 5xx error keeps its status, and the gateway replaces the message with a generic one.
An answer can have the type `refusal` when the model declines a question.

## Billing

Each model has two price fields: "Input token unit price" and "Price per USD of OpenRouter cost". Use one of them in each model's expression.

- Billing by input tokens repeats OpenRouter's list price. For `liquid/d1.1` at 0.02 USD per million input tokens the expression is `tier("base", u("input_tokens") * 0.02 / 1000000)`. `parallel/decisions-fast` charges 0.001 USD per request: `tier("base", 0.001)`. Free models use `tier("base", 0)`.
- Billing by OpenRouter cost charges what OpenRouter reports in `usage.cost`, which includes per-request and web search fees: `tier("base", u("upstream_cost"))`. Multiply it for a markup, for example `tier("base", u("upstream_cost") * 1.2)`. On a BYOK OpenRouter key, `usage.cost` holds only OpenRouter's fee.

`google/gemini-decision-1` and `openai/gpt-6-luna-decisions` charge web searches separately, so bill them by OpenRouter cost.
When the request arrives, the gateway reserves quota for the model's full context at list price. When OpenRouter answers, the gateway settles the charge on the usage OpenRouter reports.

## Example

```bash
curl https://your-gateway.example.com/decision/v1/systemone \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "liquid/d1.1",
    "state": {"ticket": "My checkout page shows a blank screen after I click Pay."},
    "questions": {
      "team": {"type": "choice", "criteria": {"payments": "Checkout or billing", "frontend": "Rendering", "account": "Login"}},
      "is_bug": {"type": "noul", "instructions": "Is the customer reporting a defect?"},
      "urgency": {"type": "score", "criteria": ["Can wait", "This week", "Blocking revenue"]}
    }
  }'
```

## Limits

- The request takes the top-level fields `model`, `state`, `questions`, `assets`, `provider`, `session_id`, `trace` and `user`. A request with any other top-level field is rejected.
- The request must be JSON. Images go in `state` as `image_url` parts or in `assets` as base64.
