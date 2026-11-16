---
locale: zh-CN
---
# OpenRouter Decision

通过 OpenRouter 上的任意决策模型，就一段文字、数据或媒体回答带类型的问题，例如 Jev、Liquid d1.1、Cloudflare Clef、Perplexity Decider。客户端改请求体里的 `model` 就能切换模型，答案在同一个响应里返回。

## 渠道设置

- 渠道类型选任务插件 (61)，并绑定 OpenRouter Decision 插件。
- 密钥填 OpenRouter 的 API Key，详见 [Decisions API 文档](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request)。
- API 地址留空时使用 `https://openrouter.ai`。地址末尾带 `/api` 或 `/api/v1` 也可以。
- 把要提供的模型加到渠道的模型列表里。模型权限和分组和其他渠道一样生效。
- 如果上游是另一台 New API 网关，渠道类型选 New API (60)，填写该网关的地址和它的令牌。上游网关也需要安装 OpenRouter Decision 插件。

## 模型与接口

| 接口 | 用途 |
| --- | --- |
| `POST /decision/v1/systemone` | 把决策请求发给 OpenRouter，返回它的答案和用量。 |

插件支持 OpenRouter 目录在 2026-11-16 列出的 40 个可通过 Decisions API 调用的模型：

- Baseten：`baseten/elephant-1`、`baseten/joey-1`、`baseten/mammoth-1`
- Cloudflare：`cloudflare/clef`、`cloudflare/clef-flash`、`cloudflare/clef-omni`
- Google：`google/gemini-decision-1`
- HeyGen：`heygen/heygen-decision-1`、`heygen/heygen-decision-1-turbo`
- Jared Palmer：`jaredpalmer/kev-4b`
- Liquid AI：`liquid/d1`、`liquid/d1-ultra`、`liquid/d1.1`、`~liquid/d1-latest`、`~liquid/d1-ultra-latest`
- Microsoft：`microsoft/microsoft-decision-1`
- Morph：`morph/reflex`
- Nace.AI：`nace-ai/drex-max`、`nace-ai/drex-max-finance`、`nace-ai/drex-v1.5`、`nace-ai/drex-v2.0`
- OpenAI：`openai/gpt-6-luna-decisions`
- Parallel：`parallel/decisions-fast`
- Perplexity：`perplexity/pplx-decider-v1.2`、`perplexity/pplx-decider-flash-v1.2`、`perplexity/pplx-decider-v1.3:free`、`perplexity/pplx-decider-flash-v1.3:free`、`~perplexity/pplx-decider-latest`、`~perplexity/pplx-decider-flash-latest`
- Respan：`respan/span-01`、`respan/span-01-lite`、`respan/span-01-lite:free`、`respan/span-02`
- ScaleDown：`scaledown/classify-1`
- Together：`togethercomputer/tev1-4b-experimental`
- TypeSafe：`typesafe/jev-1.13`、`typesafe/jev-1.14`、`~typesafe/jev-latest`
- Upstage：`upstage/solar-decide`、`upstage/solar-decide-flash`

目录里的 `cloudflare/clairic` 只支持 Extractions API，插件不收录。OpenRouter 标注 `liquid/d1` 将于 2026-11-20 下架。
不在列表里的模型由网关直接返回 400 错误，不会发到 OpenRouter。

问题类型有 `choice`、`noul` 和 `score`，Jev 还支持 `box`。每个模型接受哪些问题类型、媒体格式和 `state` 结构，以该模型自身能力为准；OpenRouter 对不支持的请求返回 400。
错误按 OpenRouter 的格式 `{"error": {"code", "message"}}` 返回给客户端。OpenRouter 的 4xx 错误保留原状态码和原始信息；5xx 错误保留状态码，信息由网关换成通用提示。
模型拒绝回答某个问题时，该答案的类型为 `refusal`。

## 计费

每个模型有两个价格字段：“输入 token 单价”和“每 1 美元 OpenRouter 费用（usage.cost）的价格”。每个模型的表达式选用其中一个。

- 按输入 token 计费，与 OpenRouter 标价一致。`liquid/d1.1` 每百万输入 token 0.02 美元，表达式为 `tier("base", u("input_tokens") * 0.02 / 1000000)`。`parallel/decisions-fast` 按次收费 0.001 美元：`tier("base", 0.001)`。免费模型用 `tier("base", 0)`。
- 按 OpenRouter 费用计费，收取 OpenRouter 在 `usage.cost` 里报告的金额，包含按次费用和联网搜索费用：`tier("base", u("upstream_cost"))`。需要加价时乘以倍率，例如 `tier("base", u("upstream_cost") * 1.2)`。使用 BYOK 的 OpenRouter Key 时，`usage.cost` 只包含 OpenRouter 的服务费。

`google/gemini-decision-1` 和 `openai/gpt-6-luna-decisions` 的联网搜索单独收费，建议按 OpenRouter 费用计费。
请求到达时，网关按该模型的完整上下文和标价预扣额度。OpenRouter 返回结果后，按它报告的用量结算。

## 示例

```bash
curl https://your-gateway.example.com/decision/v1/systemone \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "liquid/d1.1",
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
