---
changelogVersion: 1
plugin: "decision"
version: "1.0.0"
locale: "zh-CN"
---
# Changelog

## [1.0.0]

### Added

- 通过 `POST /decision/v1/systemone` 调用 OpenRouter 上的全部决策模型，用 `model` 字段切换模型。请求包含 `model`、`state` 和 `questions`，响应原样返回 OpenRouter 的 `answers`、`usage` 等字段。
- 支持 OpenRouter 目录在 2026-11-16 列出的 40 个 Decisions API 模型，包括 `:free` 变体和 `~typesafe/jev-latest` 这类 `~` 别名。只支持 Extractions API 的模型不收录。
- 所有模型都能问 `choice`、`noul` 和 `score` 问题，Jev 还能问 `box` 问题。每个模型接受的问题类型和媒体以其上游能力为准。
- `assets`、`provider`、`session_id`、`trace` 和 `user` 会随请求一起发给 OpenRouter。
- 白名单外的模型由网关返回 400 错误。OpenRouter 自己的错误按 OpenRouter 的格式交给客户端，4xx 错误保留 OpenRouter 的原始信息。
- 每个模型可以按输入 token 计费，也可以按 OpenRouter 报告的费用计费。网关按模型完整上下文预扣额度，再按上游报告的用量结算。
- 可以通过 New API (60) 渠道把另一台 New API 网关作为上游。

### Migration

- 提供模型前先为它定价，使用任务用量表达式计费。按 OpenRouter 标价，`liquid/d1.1` 为 `tier("base", u("input_tokens") * 0.02 / 1000000)`，`typesafe/jev-1.14` 为 `tier("base", u("input_tokens") * 0.042 / 1000000)`。如果想按 OpenRouter 实际收费计费（含按次费用和联网搜索费用），使用 `tier("base", u("upstream_cost"))`。
