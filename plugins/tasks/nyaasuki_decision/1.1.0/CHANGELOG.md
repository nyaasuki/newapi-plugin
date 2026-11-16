---
changelogVersion: 1
plugin: "nyaasuki_decision"
version: "1.1.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.1.0]

### Removed

- `d1` (OpenRouter's `liquid/d1`) is no longer offered, because OpenRouter retires it on 2026-11-20. Requests for `d1` now get a 400 error from the gateway. Use `d1.1` instead. The plugin serves 39 models.

### Migration

- Remove `d1` from your OpenRouter Decision channels' model lists, and point any clients that call `d1` to `d1.1`.
