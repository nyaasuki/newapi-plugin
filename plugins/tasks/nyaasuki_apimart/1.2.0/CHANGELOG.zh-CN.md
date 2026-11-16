---
changelogVersion: 1
plugin: "nyaasuki_apimart"
version: "1.2.0"
locale: "zh-CN"
---
# Changelog

## [1.2.0]

### Changed

- 插件 key 改为 `nyaasuki_apimart`，现在可以从 nyaasuki/newapi-plugin 插件市场源安装。New API 只允许安装 key 以作者名加下划线开头的第三方市场插件。之前的版本使用 key `apimart`。
- 异步任务改为提交到 `POST /v1/tasks/nyaasuki_apimart`，该路径随新 key 命名。`GET /v1/tasks/{id}` 及其产物接口、OpenAI 图片接口和所有模型名保持不变。

### Migration

- 先在旧的 `apimart` 插件旁安装此版本，再把每个 APIMart 渠道绑定的插件改为 `nyaasuki_apimart`。模型价格按模型设置，会继续生效；为单个插件单独保存的 `apimart::<模型>` 价格需要重新保存为 `nyaasuki_apimart::<模型>`。
- 向 `POST /v1/tasks/apimart` 提交任务的客户端，需要改用 `POST /v1/tasks/nyaasuki_apimart`。
- 渠道迁移完成后，停用或删除旧的 `apimart` 插件。
