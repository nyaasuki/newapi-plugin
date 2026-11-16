---
changelogVersion: 1
plugin: "nyaasuki_decision"
version: "1.2.0"
locale: "zh-CN"
---
# Changelog

## [1.2.0]

### Changed

- 接口改为 `POST /v1/systemone`。同样的请求也可以发到 `POST /nyaasuki_decision/v1/systemone`，这个地址只由本插件处理。之前的版本使用 `POST /decision/v1/systemone`，此版本不再提供该地址。
- `/v1/systemone` 也是 TypeSafe 插件的接口。两个插件都安装时，每个请求按 `model` 交给声明了该模型的插件。
- 通过 New API (60) 渠道转发时，改为调用上游网关的 `/nyaasuki_decision/v1/systemone`。

### Migration

- 把客户端的请求地址从 `/decision/v1/systemone` 改为 `/v1/systemone`。
- 如果通过另一台 New API 网关调用本插件，那台网关上的插件也要升级到 1.2.0。
- 如果同时安装了 TypeSafe 插件，`jev-latest` 只在其中一个渠道上开放，或者让客户端用 `/nyaasuki_decision/v1/systemone` 调用它。
