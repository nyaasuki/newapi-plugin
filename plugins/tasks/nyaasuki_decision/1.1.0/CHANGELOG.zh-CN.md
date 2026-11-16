---
changelogVersion: 1
plugin: "nyaasuki_decision"
version: "1.1.0"
locale: "zh-CN"
---
# Changelog

## [1.1.0]

### Removed

- 下线 `d1`（OpenRouter 的 `liquid/d1`），因为 OpenRouter 将于 2026-11-20 停止提供该模型。调用 `d1` 的请求现在由网关返回 400 错误，请改用 `d1.1`。插件现支持 39 个模型。

### Migration

- 从 OpenRouter Decision 渠道的模型列表中删除 `d1`，并让调用 `d1` 的客户端改用 `d1.1`。
