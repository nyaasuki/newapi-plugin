---
changelogVersion: 1
plugin: "nyaasuki_apimart"
version: "1.2.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.2.0]

### Changed

- The plugin key is now `nyaasuki_apimart`, so the plugin can be installed from the nyaasuki/newapi-plugin marketplace source. New API installs third-party marketplace plugins only when the key starts with the author's name and an underscore. Earlier versions used the key `apimart`.
- Submit asynchronous tasks to `POST /v1/tasks/nyaasuki_apimart`, which is named after the new key. `GET /v1/tasks/{id}`, its artifacts, the OpenAI image endpoints and every model name stay the same.

### Migration

- Install this version next to the old `apimart` plugin, then switch each APIMart channel to the plugin key `nyaasuki_apimart`. Model prices carry over because they are set per model. Prices saved for a single plugin as `apimart::<model>` need to be saved again as `nyaasuki_apimart::<model>`.
- Clients that submit tasks to `POST /v1/tasks/apimart` need to use `POST /v1/tasks/nyaasuki_apimart`.
- After the channels have moved, switch off or delete the old `apimart` plugin.
