---
changelogVersion: 1
plugin: "nyaasuki_decision"
version: "1.2.1"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.2.1]

### Fixed

- Errors from OpenRouter now reach the client as only their `error` object. Earlier versions passed on OpenRouter's whole error body, which can carry fields beside `error`, such as the `user_id` of the OpenRouter account the channel uses. Anyone with a gateway key could read that ID from a rejected request. Status codes, `error.code`, `error.message` and `error.metadata` are unchanged.

### Migration

- No configuration changes. Upgrading the plugin is enough.
