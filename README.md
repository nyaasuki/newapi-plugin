# OpenRouter Decision 插件（New API 任务插件）

基于 New API 官方 TypeSafe 任务插件改写的通用决策插件。客户端用 New API 令牌调用 `POST /decision/v1/systemone`，在请求体里换 `model`，就能调用 OpenRouter 上的全部决策模型（Jev、Liquid d1.1、Cloudflare Clef、Perplexity Decider 等）。插件把请求转发到 `POST https://openrouter.ai/api/alpha/decisions`。

## 目录

```text
plugins/tasks/decision/            与官方插件仓库相同的布局，可直接提交到 new-api-plugins
  README.md / README.zh-CN.md      插件使用说明（渠道、模型、计费、示例）
  1.0.0/plugin.js                  插件源码（key: decision，名称: OpenRouter Decision）
  1.0.0/CHANGELOG.md / .zh-CN.md   版本说明
tools/sync-models.mjs              白名单同步脚本
tools/models.snapshot.json         本次同步用到的官方目录快照（2026-11-16）
tools/pricing.suggested.json       按官方标价生成的每个模型的建议计费表达式
test/e2e/                          端到端测试：真实 New API 服务 + 本地模拟的 OpenRouter
```

## 安装

1. New API 后台 → 任务插件 → 上传 `plugins/tasks/decision/1.0.0/plugin.js`（或 `POST /api/plugin/task`，body 为 `{"source": "..."}`）。
2. 新建渠道：类型选「任务插件 (61)」，绑定插件 `decision`，密钥填 OpenRouter API Key，API 地址留空（默认 `https://openrouter.ai`），模型列表填要开放的模型。
3. 定价：每个模型使用任务用量表达式计费，可直接复制 `tools/pricing.suggested.json` 中的表达式：
   - `by_input_tokens`：按 OpenRouter 标价的输入 token 单价，例如 `liquid/d1.1` 为 `tier("base", u("input_tokens") * 0.02 / 1000000)`。
   - `by_upstream_cost`：`tier("base", u("upstream_cost"))`，按 OpenRouter 返回的 `usage.cost` 计费，包含按次费用和联网搜索费用，可乘倍率加价。
   未定价的模型调用时会返回 `model_price_error`。
4. 用 New API 令牌调用：

```bash
curl https://your-gateway.example.com/decision/v1/systemone -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" -d '{"model":"liquid/d1.1","state":"The package arrived crushed.","questions":{"refund":{"type":"noul","instructions":"Does the customer want a refund?"}}}'
```

## 白名单同步

白名单以 OpenRouter 官方目录 `https://openrouter.ai/api/v1/models?output_modalities=decisions` 为准：只收录 `endpoints` 含 `/api/alpha/decisions` 的条目（包括 `:free` 变体和 `~` 别名），只支持 `/api/alpha/extractions` 的条目（目前是 `cloudflare/clairic`）排除。

检查当前白名单是否与官方目录一致（不一致时退出码为 1，并列出增删的模型）：

```bash
node tools/sync-models.mjs --check
```

模型上架或下架后的更新流程：

1. 复制上一个版本目录为新版本（如 `1.0.0` → `1.1.0`），并把 `plugin.js` 里的 `version` 改成新版本号。已发布的版本目录不要修改。
2. 运行同步脚本，它会改写新版本 `plugin.js` 中 `BEGIN/END GENERATED MODEL CATALOG` 之间的模型表，并刷新快照和建议定价：

```bash
node tools/sync-models.mjs
```

3. 更新两份 README 的模型列表，写新版本的 CHANGELOG（新增模型需要在 Migration 中说明定价）。
4. 在 New API 后台上传新版本，并为新模型定价、加入渠道模型列表。

脚本参数：`--plugin <path>` 指定 plugin.js，`--from <url|file>` 使用其他目录来源（可用本地 JSON 离线同步），`--date <YYYY-MM-DD>` 指定快照日期。

## 测试

端到端测试会启动一个本地模拟的 OpenRouter（`127.0.0.1:18080`），对一台全新的 New API 服务完成初始化、上传插件、创建 61 渠道、定价、签发令牌，再通过网关调用：

```bash
node test/e2e/run.mjs --server http://127.0.0.1:13000
```

覆盖：`liquid/d1.1`、`typesafe/jev-1.14`、`~typesafe/jev-latest`、`:free` 变体都能拿到结构化答案；转发地址、密钥、请求体和 state 字段顺序与上游协议一致；`refusal` 答案透传；白名单外模型（含 Extractions 专用的 `cloudflare/clairic`）在网关侧返回 400 且不会请求上游；上游 400/402 按 OpenRouter 格式返回；按上游用量结算计费。

加 `--relay http://127.0.0.1:13001`（第二台全新 New API）会再测一层 New API (60) 渠道转发；加 `--real` 会把 A 的渠道换成默认地址 + 无效密钥，真实请求一次 openrouter.ai，期望拿到 OpenRouter 自己的 401。

已验证的宿主版本：New API main `1c63cc8`（2026-11-16）。插件使用了 `routes[].models`、`requiredCapabilities: ["json-order@1"]`、`upstreams` 等 API v1 扩展字段，更早的 New API 版本会拒绝加载，请先升级宿主。

说明：Jev 指南里提到的 `inception/mercury-decide` 不在 2026-11-16 的官方决策模型目录中，因此不在白名单内；它重新上架后运行同步脚本即可收录。

插件语法和元数据可用 New API 自带的检查：`new-api plugin lint plugins/tasks/decision/1.0.0/plugin.js`。
