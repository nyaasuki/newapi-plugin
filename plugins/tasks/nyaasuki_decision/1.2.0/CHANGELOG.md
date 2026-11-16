---
changelogVersion: 1
plugin: "nyaasuki_decision"
version: "1.2.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.2.0]

### Changed

- Call the plugin at `POST /v1/systemone`. The same request also works at `POST /nyaasuki_decision/v1/systemone`, which only this plugin answers. Earlier versions served `POST /decision/v1/systemone`, which this version no longer serves.
- `/v1/systemone` is also the TypeSafe plugin's path. With both plugins installed, each request goes to the plugin whose models include its `model`.
- A New API (60) channel now calls the upstream gateway at `/nyaasuki_decision/v1/systemone`.

### Migration

- Point clients from `/decision/v1/systemone` to `/v1/systemone`.
- If you reach this plugin through another New API gateway, upgrade the plugin on that gateway to 1.2.0 as well.
- If the TypeSafe plugin is also installed, offer `jev-latest` on only one of the two channels, or have clients call `/nyaasuki_decision/v1/systemone` for it.
