---
locale: zh-CN
---
# APIMart

用 APIMart 的图像模型生成和编辑图片：GPT-Image、Nano Banana、Imagen、Seedream、FLUX、Hy-Image、MAI-Image、Qwen、Z-Image、万相和 Grok Imagine。APIMart 的接口是异步的，网关会在请求内轮询任务，客户端用标准 OpenAI 图片接口就能直接拿到图片。

## 渠道设置

- 渠道类型选任务插件 (61)，并绑定 APIMart 插件（key 为 `nyaasuki_apimart`）。
- 密钥填 APIMart 的 API Key，详见 [APIMart 文档](https://docs.apimart.ai/cn/api-reference/texts/models/list)。
- API 地址留空时使用 `https://api.apimart.ai`。地址末尾带 `/v1` 也可以。
- 把要提供的模型名加到渠道的模型列表里。想对外用别的名字，可以用渠道的模型重定向，例如 `{"gpt-image-2.5": "gpt-image-2.5-flare"}`。

## 模型与接口

| 接口 | 用途 |
| --- | --- |
| `POST /v1/images/generations` | 生成图片，在同一个响应里返回 `{created, data: [{url}]}`。 |
| `POST /v1/images/edits` | 用参考图编辑图片，GPT-Image 系列还支持蒙版。 |
| `POST /v1/tasks/nyaasuki_apimart` | 提交任务后立即返回。用 `GET /v1/tasks/{id}` 查询，用 `GET /v1/tasks/{id}/artifacts` 获取图片。 |

插件支持 55 个模型名（含 APIMart 别名）：

| 系列 | 模型 |
| --- | --- |
| GPT-Image-2.5 | `gpt-image-2.5-flare`、`gpt-image-2.5-sunburst`、`gpt-image-2.5-ext` |
| GPT-Image-2 | `gpt-image-2`、`gpt-image-2-ext`、`gpt-image-2-official` |
| GPT-Image 1 和 1.5 | `gpt-image-1-official`、`gpt-image-1.5-official` |
| Nano Banana 2.1 | `gemini-nano-banana-2.1`、`gemini-nano-banana-2.1-ext` |
| Nano Banana 2 | `gemini-3.1-flash-image-preview`（`nano-banana-2-ext`）、`gemini-3.1-flash-image-preview-official`（`nano-banana-2`） |
| Nano Banana Lite | `gemini-3.1-flash-lite-image`（`nano-banana-2-lite`）、`gemini-3.1-flash-lite-image-ext`（`nano-banana-2-lite-ext`） |
| Nano Banana Pro | `gemini-3-pro-image-preview`（`nano-banana-pro-ext`）、`gemini-3-pro-image-preview-official`（`nano-banana-pro`） |
| Nano Banana | `gemini-2.5-flash-image-preview`（`nano-banana-ext`）、`gemini-2.5-flash-image-preview-official`（`nano-banana`） |
| Imagen 4.0 | `imagen-4.0-apimart` |
| Seedream | `seedream-4.0`、`seedream-4.5`、`seedream-5-0-lite`、`seedream-5-0-pro`、`seedream-5-0-flash` |
| FLUX | `flux-kontext-pro`、`flux-kontext-max`、`flux-2-flex`、`flux-2-pro`、`flux-2-max`、`flux-3-image`、`flux-3-image-klein` |
| Hy-Image | `hy-image-v3.5-preview` |
| MAI-Image | `mai-image-2.6`、`mai-image-2.6-flash` |
| Qwen Image | `qwen-image-2.0`、`qwen-image-2.0-pro`、`qwen-image-3.0`、`qwen-image-3.0-pro` |
| Z-Image | `z-image-turbo` |
| 万相 2.7 | `wan2.7-image-pro`、`wan2.7-image` |
| Grok Imagine | `grok-imagine-1.5-apimart`（`grok-imagine-1.5-ext`）、`grok-imagine-image`、`grok-imagine-image-quality`、`grok-imagine-image-2.0`、`grok-imagine-2.0-ext` |

括号里是 APIMart 的别名，插件同样支持。
插件在发送前按模型检查尺寸、分辨率、张数和参考图，不合法的请求不会产生上游费用。模型特有的参数（例如 Seedream 的 `watermark`、FLUX 的 `seed`）按 APIMart 文档写在请求体里。模型不支持的字段（例如 `user`、`style`）会被丢弃。
也兼容 OpenAI 写法：`1024x1024` 这类像素尺寸会换成最接近的支持比例和能覆盖它的分辨率档位，`quality: "standard"`、`"hd"` 映射为 `medium`、`high`，`image`、`images` 视为参考图。
传 `response_format: "b64_json"` 可以拿到 Base64 图片，由网关下载后补上。

## 计费

GPT-Image-2.5（`gpt-image-2.5-flare`、`gpt-image-2.5-sunburst`）和 `gpt-image-2-official` 按 token 计费，其他模型按张计费。

- token 计费的模型有“输入 token 单价”和“输出图片 token 单价”。APIMart 返回的输入 token 不区分文本和参考图：只做文生图时按文本单价设置，有图生图需求时按图片单价设置。按 APIMart GPT-Image-2.5 每百万 token 文本输入 5 美元、输出 30 美元的价格，表达式为 `tier("base", u("input_tokens") * 5 / 1000000 + u("output_tokens") * 30 / 1000000)`。
- 按张计费的模型都有生成张数字段，部分模型还有分辨率档位、参考图张数、质量、尺寸、版本或智能改写字段，价格可以随它们变化。价格编辑器只显示该模型用到的字段。
- 也可以按次计费，网关会以请求张数作为倍率。

请求到达时，网关按请求张数预扣额度；GPT-Image-2.5 不指定 `quality` 时按最高档预扣。任务完成后按 APIMart 实际返回的图片结算，任务失败自动退款。

## 示例

```bash
curl https://your-gateway.example.com/v1/images/generations \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-banana-pro",
    "prompt": "雨天窗边温暖舒适的阅读角，暖色台灯，电影感光影",
    "size": "16:9",
    "resolution": "2K"
  }'
```

## 限制

- GPT-Image-2.5、`gpt-image-2-official`、GPT-Image 1 和 1.5、Hy-Image、Qwen Image 2.0 和 Grok 系列只接受 `image_urls` 里的公网 http(s) 参考图链接，对这些模型向 `/v1/images/edits` 上传图片文件会被拒绝。其他模型也接受 data URL 和上传的文件。
- 只有 GPT-Image 系列支持蒙版：URL、PNG data URL，或上传的 `mask` 文件（不超过 4 MB，带 Alpha 通道，尺寸与第一张参考图一致）。
- OpenAI 图片接口最多等待 `TASK_PLUGIN_PROTOCOL_TIMEOUT_SECONDS`（默认 600 秒），超时返回 504，任务仍会在后台完成并结算。Seedream 5.0 Pro、4K 档位等较慢的模型，需要调大客户端和反向代理的超时。
- 图片链接来自 APIMart，一般 24 到 72 小时后过期，请及时下载，或使用 `b64_json`。
- 不支持流式、Midjourney 和 Grok 图层/选区编辑。
