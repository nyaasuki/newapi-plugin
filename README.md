# newapi-plugin

[New API](https://github.com/QuantumNous/new-api) 任务插件合集，同时也是一个可以直接添加到 New API 的**插件市场源**（根目录 `index.json`）。

| 插件 | Key | 用途 | 接口 | 最新版本 |
| --- | --- | --- | --- | --- |
| [APIMart](plugins/tasks/nyaasuki_apimart/README.zh-CN.md) | `nyaasuki_apimart` | 接入 APIMart 图像模型：GPT-Image、Nano Banana、Imagen、Seedream、FLUX、Qwen、万相、Grok Imagine 等 55 个模型名 | OpenAI 图片接口 `/v1/images/generations`、`/v1/images/edits`，以及 `/v1/tasks/nyaasuki_apimart` | 1.2.0 |
| [OpenRouter Decision](plugins/tasks/nyaasuki_decision/README.zh-CN.md) | `nyaasuki_decision` | 接入 OpenRouter 全部 40 个决策模型：Jev、Liquid d1.1、Cloudflare Clef、Perplexity Decider 等 | `POST /decision/v1/systemone` | 1.0.0 |

每个插件的渠道配置、模型列表、计费和调用示例见各自的 README（[APIMart](plugins/tasks/nyaasuki_apimart/README.zh-CN.md) · [OpenRouter Decision](plugins/tasks/nyaasuki_decision/README.zh-CN.md)，英文版为同目录的 `README.md`）。

> New API 的任务插件系统仍是实验性功能，请先在测试实例上验证。两个插件都用到了较新的插件 API 扩展（`usageProfiles`、`routes[].models`、`requiredCapabilities` 等），已在 New API main `1c63cc8`（2026-11-16）上验证，更早的版本可能拒绝加载。

## 安装

用 Root 账号登录 New API，打开「任务插件」页面并打开总开关，然后任选一种方式：

**方式一：添加市场源（推荐，之后能在市场里看到新版本）**

在「市场源」里点「添加源」，索引 URL 填：

```text
https://raw.githubusercontent.com/nyaasuki/newapi-plugin/main/index.json
```

保存后在插件市场里找到 APIMart 或 OpenRouter Decision 安装。安装时 New API 会校验 `index.json` 里记录的 sha256，并展示插件的使用说明和更新日志。

**方式二：直接导入单个插件**

```text
https://raw.githubusercontent.com/nyaasuki/newapi-plugin/main/plugins/tasks/nyaasuki_apimart/1.2.0/plugin.js
https://raw.githubusercontent.com/nyaasuki/newapi-plugin/main/plugins/tasks/nyaasuki_decision/1.0.0/plugin.js
```

也可以下载 `plugin.js` 后上传或粘贴源码。无论哪种方式，安装前请自行检查源码。

插件 key 统一带 `nyaasuki_` 前缀：New API 只允许从第三方市场源安装 key 以作者名加下划线开头的插件（例如 `alice_foo`）。

**从旧的 `apimart` 插件迁移**（`nyaasuki/newapi-plugin-apimart` 中的 1.0.0 / 1.1.0）：APIMart 从 1.2.0 起改用 key `nyaasuki_apimart`。先安装新插件，把 APIMart 渠道绑定的插件改为 `nyaasuki_apimart`，再停用旧的 `apimart`。模型价格按模型设置，会继续生效；异步任务的提交地址变为 `POST /v1/tasks/nyaasuki_apimart`。详见 [1.2.0 更新日志](plugins/tasks/nyaasuki_apimart/1.2.0/CHANGELOG.zh-CN.md)。旧版本已从本市场移除，仍可在 Git 历史中找到。

## 仓库结构

```text
plugins/tasks/<key>/<version>/plugin.js           插件源码（单文件，目录名与 meta.key / meta.version 一致）
plugins/tasks/<key>/<version>/CHANGELOG.md        该版本的更新日志（英文，必需）
plugins/tasks/<key>/<version>/CHANGELOG.zh-CN.md  中文翻译
plugins/tasks/<key>/README.md / README.zh-CN.md   插件使用说明，所有版本共用
index.json                                        市场索引，由 tools/pluginindex 生成，勿手改
tools/pluginindex/                                官方索引生成器（来自 QuantumNous/new-api-plugins，Apache-2.0）
tools/decision/                                   OpenRouter Decision 的白名单同步脚本、目录快照和建议定价
test/apimart/                                     APIMart 的钩子测试和 golden fixture
test/decision/e2e/                                OpenRouter Decision 的端到端测试（真实 New API + 模拟 OpenRouter）
test/marketplace/install.mjs                      模拟从本仓库市场源安装全部插件
```

布局和索引格式与官方插件仓库 [QuantumNous/new-api-plugins](https://github.com/QuantumNous/new-api-plugins) 一致（见其 `docs/marketplace.md`）。

## 发布规则

- **已发布的版本目录不可修改。** `index.json` 里记录了每个 `plugin.js` 的 sha256，改动已发布的文件会让市场安装校验失败。修复或新功能请新建版本目录（如 `plugins/tasks/nyaasuki_apimart/1.2.1/`），同步修改 `meta.version`，附上英文 `CHANGELOG.md` 和中文翻译。
- 插件级 README 可以直接更新。
- 改动任何插件文件、README 或 CHANGELOG 后，重新生成 `index.json` 并一起提交。

## 生成索引

索引生成器会用 New API 自己的插件编译器编译每个版本，所以需要在本仓库**旁边**放一份 New API 源码（与官方仓库的做法相同），并安装 Go（版本见 New API 的 `go.mod`）：

```text
D:\code\newapi-plugin   本仓库
D:\code\new-api         git clone https://github.com/QuantumNous/new-api.git
```

```bash
cd tools/pluginindex
go run . generate ../..   # 重新生成 index.json
go run . check ../..      # 检查 index.json 是否最新（CI 也会跑）
```

发布前可以在一台全新的 New API 上模拟市场安装：脚本把本仓库作为本地市场源（`127.0.0.1:18090`），像后台的安装对话框一样拉取 `index.json`、`plugin.js`、README 和 CHANGELOG，逐个校验 sha256，再按第三方市场源的规则安装每个插件的最新版本：

```bash
node test/marketplace/install.mjs --server http://127.0.0.1:13000
```

推送到 GitHub 后，`.github/workflows/validate.yml` 会自动编译全部插件、检查索引是否最新、运行 APIMart 测试，并在 PR 中拒绝修改已发布的 `plugin.js`。

## 各插件的开发命令

APIMart：

```bash
node test/apimart/run.mjs      # 钩子测试（针对最新版本）
node test/apimart/golden.mjs   # 回放 golden fixture
```

OpenRouter Decision：

```bash
node tools/decision/sync-models.mjs --check   # 白名单是否与 OpenRouter 官方目录一致
node tools/decision/sync-models.mjs           # 同步白名单（写入最新版本的 plugin.js）
node test/decision/e2e/run.mjs --server http://127.0.0.1:13000 --relay http://127.0.0.1:13001 --real
```

Decision 的白名单以 OpenRouter 官方目录 `https://openrouter.ai/api/v1/models?output_modalities=decisions` 为准，只收录可通过 Decisions API 调用的模型；New API 侧的模型名是去掉厂商前缀的 OpenRouter ID（`liquid/d1.1` → `d1.1`）。模型上架或下架时：复制最新版本目录为新版本并改 `meta.version`，运行同步脚本，更新 README 模型表和 CHANGELOG，最后重新生成索引。

端到端测试需要两台全新的 New API（13000、13001），会在本地 18080 端口启动一个模拟的 OpenRouter；`--real` 会用无效密钥真实请求一次 openrouter.ai，期望拿到 401。

## License

MIT。`tools/pluginindex/` 来自 QuantumNous/new-api-plugins，遵循 Apache-2.0，见该目录下的 LICENSE。
