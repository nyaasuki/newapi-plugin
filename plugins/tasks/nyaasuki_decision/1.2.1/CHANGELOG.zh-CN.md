---
changelogVersion: 1
plugin: "nyaasuki_decision"
version: "1.2.1"
locale: "zh-CN"
---
# Changelog

## [1.2.1]

### Fixed

- OpenRouter 的错误现在只把 `error` 对象返回给客户端。之前的版本会原样返回 OpenRouter 的整个错误响应，其中 `error` 之外可能还有其他字段，例如渠道所用 OpenRouter 账号的 `user_id`，任何持有网关密钥的人都能从被拒绝的请求里看到它。状态码以及 `error.code`、`error.message`、`error.metadata` 不变。

### Migration

- 不需要改配置，升级插件即可。
