---
translations:
  zh-CN: README.zh-CN.md
---
# OpenRouter Decision

Answers typed questions about text, data or media with any decision model on OpenRouter, such as Jev, Liquid d1.1, Cloudflare Clef or Perplexity Decider. Clients switch models by changing `model` in the request body. The answers come back in the same response.

## Channel setup

- Choose the Task Plugin (61) channel type and bind the OpenRouter Decision plugin (key `nyaasuki_decision`).
- The key is an OpenRouter API key. See the [Decisions API reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request).
- Leave the API address empty to use `https://openrouter.ai`. An address ending in `/api` or `/api/v1` also works.
- Add the models you want to offer to the channel, by their New API names below. Model permissions and groups work as on any other channel.
- To use another New API gateway as the upstream, choose New API (60) and enter that gateway's address and one of its tokens. That gateway needs the OpenRouter Decision plugin too.

## Models and endpoints

| Endpoint | What it does |
| --- | --- |
| `POST /decision/v1/systemone` | Sends a Decisions request to OpenRouter and returns its answers and usage. |

In New API each model is named by its OpenRouter ID without the vendor prefix: clients call `d1.1`, and the gateway shows and bills `d1.1`, while OpenRouter receives `liquid/d1.1`. The reply's `model` field also says `d1.1`.
The plugin serves the 40 models that OpenRouter's catalog listed for the Decisions API on 2026-11-16:

| New API model | OpenRouter ID |
| --- | --- |
| `elephant-1` | `baseten/elephant-1` |
| `joey-1` | `baseten/joey-1` |
| `mammoth-1` | `baseten/mammoth-1` |
| `clef` | `cloudflare/clef` |
| `clef-flash` | `cloudflare/clef-flash` |
| `clef-omni` | `cloudflare/clef-omni` |
| `gemini-decision-1` | `google/gemini-decision-1` |
| `heygen-decision-1` | `heygen/heygen-decision-1` |
| `heygen-decision-1-turbo` | `heygen/heygen-decision-1-turbo` |
| `kev-4b` | `jaredpalmer/kev-4b` |
| `d1` | `liquid/d1` |
| `d1-latest` | `~liquid/d1-latest` |
| `d1-ultra` | `liquid/d1-ultra` |
| `d1-ultra-latest` | `~liquid/d1-ultra-latest` |
| `d1.1` | `liquid/d1.1` |
| `microsoft-decision-1` | `microsoft/microsoft-decision-1` |
| `reflex` | `morph/reflex` |
| `drex-max` | `nace-ai/drex-max` |
| `drex-max-finance` | `nace-ai/drex-max-finance` |
| `drex-v1.5` | `nace-ai/drex-v1.5` |
| `drex-v2.0` | `nace-ai/drex-v2.0` |
| `gpt-6-luna-decisions` | `openai/gpt-6-luna-decisions` |
| `decisions-fast` | `parallel/decisions-fast` |
| `pplx-decider-flash-latest` | `~perplexity/pplx-decider-flash-latest` |
| `pplx-decider-flash-v1.2` | `perplexity/pplx-decider-flash-v1.2` |
| `pplx-decider-flash-v1.3:free` | `perplexity/pplx-decider-flash-v1.3:free` |
| `pplx-decider-latest` | `~perplexity/pplx-decider-latest` |
| `pplx-decider-v1.2` | `perplexity/pplx-decider-v1.2` |
| `pplx-decider-v1.3:free` | `perplexity/pplx-decider-v1.3:free` |
| `span-01` | `respan/span-01` |
| `span-01-lite` | `respan/span-01-lite` |
| `span-01-lite:free` | `respan/span-01-lite:free` |
| `span-02` | `respan/span-02` |
| `classify-1` | `scaledown/classify-1` |
| `tev1-4b-experimental` | `togethercomputer/tev1-4b-experimental` |
| `jev-1.13` | `typesafe/jev-1.13` |
| `jev-1.14` | `typesafe/jev-1.14` |
| `jev-latest` | `~typesafe/jev-latest` |
| `solar-decide` | `upstage/solar-decide` |
| `solar-decide-flash` | `upstage/solar-decide-flash` |

`cloudflare/clairic` is in the catalog but serves only the Extractions API, so the plugin leaves it out. OpenRouter lists `liquid/d1` as expiring on 2026-11-20.
A model outside this list, including a full OpenRouter ID such as `liquid/d1.1`, gets a 400 error from the gateway and never reaches OpenRouter.
The TypeSafe plugin also declares `jev-latest`. When both plugins are installed, the model-level price of `jev-latest` applies to both; set a provider price for `nyaasuki_decision::jev-latest` to price this plugin's calls separately.

Questions use the types `choice`, `noul` and `score`. Jev also answers `box`. Which question types, media parts and `state` shapes a model accepts is up to that model; OpenRouter answers anything else with a 400.
Errors reach the client as `{"error": {"code", "message"}}`, as OpenRouter writes them. A 4xx error from OpenRouter keeps its status and message. A 5xx error keeps its status, and the gateway replaces the message with a generic one.
An answer can have the type `refusal` when the model declines a question.

## Billing

Each model has two price fields: "Input token unit price" and "Price per USD of OpenRouter cost". Use one of them in each model's expression.

- Billing by input tokens repeats OpenRouter's list price. For `d1.1` at 0.02 USD per million input tokens the expression is `tier("base", u("input_tokens") * 0.02 / 1000000)`. `decisions-fast` charges 0.001 USD per request: `tier("base", 0.001)`. Free models use `tier("base", 0)`.
- Billing by OpenRouter cost charges what OpenRouter reports in `usage.cost`, which includes per-request and web search fees: `tier("base", u("upstream_cost"))`. Multiply it for a markup, for example `tier("base", u("upstream_cost") * 1.2)`. On a BYOK OpenRouter key, `usage.cost` holds only OpenRouter's fee.

`gemini-decision-1` and `gpt-6-luna-decisions` charge web searches separately, so bill them by OpenRouter cost.
When the request arrives, the gateway reserves quota for the model's full context at list price. When OpenRouter answers, the gateway settles the charge on the usage OpenRouter reports.

### Price sync

The prices of all 40 models can come from New API's upstream price sync instead of being typed in. The repository publishes a price feed in the format of New API's `/api/ratio_config`, rebuilt from OpenRouter's catalog:

```text
https://raw.githubusercontent.com/nyaasuki/newapi-plugin/main/pricing/nyaasuki_decision.json
```

1. Open the price sync in New API's model pricing settings and select the OpenRouter Decision channel.
2. Set the channel's endpoint to custom and enter the feed address above.
3. Fetch, select the models to take, and apply.

The feed bills each model by input tokens at OpenRouter's list price, plus the per-request fee where there is one. `gemini-decision-1` and `gpt-6-luna-decisions` are billed at the OpenRouter cost, because only that includes their web searches. Free models cost nothing. The prices are taken as they are; to add a markup, edit them after syncing.
Run the sync again when OpenRouter changes its prices. A model that has left OpenRouter's catalog keeps its last price in the feed.
A gateway that reaches this one through a New API (60) channel can sync from it with the `pricing` endpoint.

## Example

```bash
curl https://your-gateway.example.com/decision/v1/systemone \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "d1.1",
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
