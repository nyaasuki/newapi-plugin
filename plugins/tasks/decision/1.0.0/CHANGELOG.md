---
changelogVersion: 1
plugin: "decision"
version: "1.0.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.0.0]

### Added

- Call every OpenRouter decision model through `POST /decision/v1/systemone`, and switch models with the `model` field. The request takes `model`, `state` and `questions`, and the reply returns OpenRouter's `answers`, `usage` and other fields as they are.
- Offer the 40 models that OpenRouter's catalog listed for the Decisions API on 2026-11-16, including the `:free` variants and the `~` aliases. Models that serve only the Extractions API are left out.
- Call each model by its OpenRouter ID without the vendor prefix, such as `d1.1` for `liquid/d1.1` or `jev-latest` for `~typesafe/jev-latest`. New API shows and bills that name, the reply's `model` field uses it, and the plugin sends the full ID to OpenRouter.
- Ask `choice`, `noul` and `score` questions on any model, and `box` questions on Jev. Each model accepts the question types and media it supports upstream.
- Send `assets`, `provider`, `session_id`, `trace` and `user` to OpenRouter along with the request.
- Get a 400 error from the gateway for a model outside the whitelist. OpenRouter's own errors reach clients in OpenRouter's format, with OpenRouter's message for 4xx errors.
- Bill each model by input tokens or by the cost OpenRouter reports. The gateway reserves quota for the model's full context and settles on the reported usage.
- Point the plugin at another New API gateway through a New API (60) channel.

### Migration

- Set a price for each model before offering it, using task usage expression billing. At OpenRouter's list price, `d1.1` is `tier("base", u("input_tokens") * 0.02 / 1000000)` and `jev-1.14` is `tier("base", u("input_tokens") * 0.042 / 1000000)`. To charge what OpenRouter charges, including per-request and web search fees, use `tier("base", u("upstream_cost"))`.
- If the TypeSafe plugin is also installed, both plugins declare `jev-latest` and share its model-level price. Set a provider price for `decision::jev-latest` to price this plugin's calls separately.
