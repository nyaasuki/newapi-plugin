---
locale: zh-CN
---
# OpenRouter Decision

通过 OpenRouter 上的任意决策模型，就一段文字、数据或媒体回答带类型的问题，例如 Jev、Liquid d1.1、Cloudflare Clef、Perplexity Decider。客户端改请求体里的 `model` 就能切换模型，答案在同一个响应里返回。

## 渠道设置

- 渠道类型选任务插件 (61)，并绑定 OpenRouter Decision 插件（key 为 `nyaasuki_decision`）。
- 密钥填 OpenRouter 的 API Key，详见 [Decisions API 文档](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request)。
- API 地址留空时使用 `https://openrouter.ai`。地址末尾带 `/api` 或 `/api/v1` 也可以。
- 按下表的 New API 模型名，把要提供的模型加到渠道的模型列表里。模型权限和分组和其他渠道一样生效。
- 如果上游是另一台 New API 网关，渠道类型选 New API (60)，填写该网关的地址和它的令牌。上游网关也需要安装 OpenRouter Decision 插件。

## 模型与接口

| 接口 | 用途 |
| --- | --- |
| `POST /decision/v1/systemone` | 把决策请求发给 OpenRouter，返回它的答案和用量。 |

在 New API 里，每个模型的名称是去掉厂商前缀的 OpenRouter ID：客户端调用 `d1.1`，网关里显示和计费的也是 `d1.1`，发给 OpenRouter 的是 `liquid/d1.1`。响应里的 `model` 字段同样是 `d1.1`。
插件支持 OpenRouter 目录在 2026-11-16 列出的 40 个可通过 Decisions API 调用的模型：

| New API 模型 | OpenRouter ID |
| --- | --- |
| `elephant-1` | `baseten/elephant-1` |
| `joey-1` | `baseten/joey-1` |
| `mammoth-1` | `baseten/mammoth-1` |
| `clef` | `cloudflare/clef` |
| `clef-flash` | `cloudflare/clef-flash` |
| `clef-omni` | `cloudflare/clef-omni` |
| `gemini-decision-1` | `google/gemini-decision-1` |
| `heygen-decision-1` | `heygen/heygen-decision-1` |
| `heygen-decision-1-turbo` | `heygen/heygen-decision-1-turbo` |
| `kev-4b` | `jaredpalmer/kev-4b` |
| `d1` | `liquid/d1` |
| `d1-latest` | `~liquid/d1-latest` |
| `d1-ultra` | `liquid/d1-ultra` |
| `d1-ultra-latest` | `~liquid/d1-ultra-latest` |
| `d1.1` | `liquid/d1.1` |
| `microsoft-decision-1` | `microsoft/microsoft-decision-1` |
| `reflex` | `morph/reflex` |
| `drex-max` | `nace-ai/drex-max` |
| `drex-max-finance` | `nace-ai/drex-max-finance` |
| `drex-v1.5` | `nace-ai/drex-v1.5` |
| `drex-v2.0` | `nace-ai/drex-v2.0` |
| `gpt-6-luna-decisions` | `openai/gpt-6-luna-decisions` |
| `decisions-fast` | `parallel/decisions-fast` |
| `pplx-decider-flash-latest` | `~perplexity/pplx-decider-flash-latest` |
| `pplx-decider-flash-v1.2` | `perplexity/pplx-decider-flash-v1.2` |
| `pplx-decider-flash-v1.3:free` | `perplexity/pplx-decider-flash-v1.3:free` |
| `pplx-decider-latest` | `~perplexity/pplx-decider-latest` |
| `pplx-decider-v1.2` | `perplexity/pplx-decider-v1.2` |
| `pplx-decider-v1.3:free` | `perplexity/pplx-decider-v1.3:free` |
| `span-01` | `respan/span-01` |
| `span-01-lite` | `respan/span-01-lite` |
| `span-01-lite:free` | `respan/span-01-lite:free` |
| `span-02` | `respan/span-02` |
| `classify-1` | `scaledown/classify-1` |
| `tev1-4b-experimental` | `togethercomputer/tev1-4b-experimental` |
| `jev-1.13` | `typesafe/jev-1.13` |
| `jev-1.14` | `typesafe/jev-1.14` |
| `jev-latest` | `~typesafe/jev-latest` |
| `solar-decide` | `upstage/solar-decide` |
| `solar-decide-flash` | `upstage/solar-decide-flash` |

目录里的 `cloudflare/clairic` 只支持 Extractions API，插件不收录。OpenRouter 标注 `liquid/d1` 将于 2026-11-20 下架。
不在列表里的模型由网关直接返回 400 错误，不会发到 OpenRouter；直接传完整的 OpenRouter ID（例如 `liquid/d1.1`）也会被拒绝。
TypeSafe 插件也声明了 `jev-latest`。两个插件都安装时，`jev-latest` 的模型级价格对两者都生效；要给本插件单独定价，请为 `nyaasuki_decision::jev-latest` 设置渠道插件价格。

问题类型有 `choice`、`noul` 和 `score`，Jev 还支持 `box`。每个模型接受哪些问题类型、媒体格式和 `state` 结构，以该模型自身能力为准；OpenRouter 对不支持的请求返回 400。
错误按 OpenRouter 的格式 `{"error": {"code", "message"}}` 返回给客户端。OpenRouter 的 4xx 错误保留原状态码和原始信息；5xx 错误保留状态码，信息由网关换成通用提示。
模型拒绝回答某个问题时，该答案的类型为 `refusal`。

## 计费

每个模型有两个价格字段：“输入 token 单价”和“每 1 美元 OpenRouter 费用（usage.cost）的价格”。每个模型的表达式选用其中一个。

- 按输入 token 计费，与 OpenRouter 标价一致。`d1.1` 每百万输入 token 0.02 美元，表达式为 `tier("base", u("input_tokens") * 0.02 / 1000000)`。`decisions-fast` 按次收费 0.001 美元：`tier("base", 0.001)`。免费模型用 `tier("base", 0)`。
- 按 OpenRouter 费用计费，收取 OpenRouter 在 `usage.cost` 里报告的金额，包含按次费用和联网搜索费用：`tier("base", u("upstream_cost"))`。需要加价时乘以倍率，例如 `tier("base", u("upstream_cost") * 1.2)`。使用 BYOK 的 OpenRouter Key 时，`usage.cost` 只包含 OpenRouter 的服务费。

`gemini-decision-1` 和 `gpt-6-luna-decisions` 的联网搜索单独收费，建议按 OpenRouter 费用计费。
请求到达时，网关按该模型的完整上下文和标价预扣额度。OpenRouter 返回结果后，按它报告的用量结算。

### 价格同步

40 个模型的价格可以用 New API 的上游价格同步导入，不必逐个填写。本仓库按 OpenRouter 官方目录生成了一份价格源，格式与 New API 的 `/api/ratio_config` 相同：

```text
https://raw.githubusercontent.com/nyaasuki/newapi-plugin/main/pricing/nyaasuki_decision.json
```

1. 在 New API 的模型价格设置里打开上游价格同步，选择 OpenRouter Decision 渠道。
2. 把该渠道的接口设为 custom，填入上面的价格源地址。
3. 获取价格，勾选要采用的模型，然后应用。

价格源按 OpenRouter 标价对输入 token 计费，有按次费用的模型再加上按次费用。`gemini-decision-1` 和 `gpt-6-luna-decisions` 按 OpenRouter 实际费用计费，因为只有这样才包含联网搜索费用。免费模型不收费。同步时价格原样导入，需要加价的话，同步后再修改。
OpenRouter 调价后再同步一次即可。已从 OpenRouter 目录下架的模型，在价格源里保留最后一次的价格。
通过 New API (60) 渠道接入本站的下游网关，可以用 `pricing` 接口从本站同步价格。

## 示例

```bash
curl https://your-gateway.example.com/decision/v1/systemone \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "d1.1",
    "state": {"ticket": "My checkout page shows a blank screen after I click Pay."},
    "questions": {
      "team": {"type": "choice", "criteria": {"payments": "Checkout or billing", "frontend": "Rendering", "account": "Login"}},
      "is_bug": {"type": "noul", "instructions": "Is the customer reporting a defect?"},
      "urgency": {"type": "score", "criteria": ["Can wait", "This week", "Blocking revenue"]}
    }
  }'
```

## 限制

- 请求的顶层字段限于 `model`、`state`、`questions`、`assets`、`provider`、`session_id`、`trace` 和 `user`。带其他顶层字段的请求会被拒绝。
- 请求必须是 JSON。图片可以作为 `image_url` 放在 `state` 里，或以 base64 放在 `assets` 里。
