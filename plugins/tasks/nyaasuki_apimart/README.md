---
translations:
  zh-CN: README.zh-CN.md
---
# APIMart

Generates and edits images with APIMart's image models: GPT-Image, Nano Banana, Imagen, Seedream, FLUX, Hy-Image, MAI-Image, Qwen, Z-Image, Wan and Grok Imagine. APIMart answers asynchronously; the gateway polls the task inside the request, so clients get their images from the standard OpenAI image endpoints.

## Channel setup

- Choose the Task Plugin (61) channel type and bind the APIMart plugin (key `nyaasuki_apimart`).
- The key is an APIMart API key. See the [APIMart docs](https://docs.apimart.ai/cn/api-reference/texts/models/list).
- Leave the API address empty to use `https://api.apimart.ai`. An address ending in `/v1` also works.
- Add the model names you want to offer to the channel. To offer a model under another name, use the channel's model mapping, for example `{"gpt-image-2.5": "gpt-image-2.5-flare"}`.

## Models and endpoints

| Endpoint | What it does |
| --- | --- |
| `POST /v1/images/generations` | Generates images and returns `{created, data: [{url}]}` in the same response. |
| `POST /v1/images/edits` | Edits images with reference images and, for GPT-Image models, a mask. |
| `POST /v1/tasks/nyaasuki_apimart` | Submits a task without waiting. Read it with `GET /v1/tasks/{id}` and its images with `GET /v1/tasks/{id}/artifacts`. |

The plugin serves 55 model names, APIMart aliases included:

| Series | Models |
| --- | --- |
| GPT-Image-2.5 | `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2.5-ext` |
| GPT-Image-2 | `gpt-image-2`, `gpt-image-2-ext`, `gpt-image-2-official` |
| GPT-Image 1 and 1.5 | `gpt-image-1-official`, `gpt-image-1.5-official` |
| Nano Banana 2.1 | `gemini-nano-banana-2.1`, `gemini-nano-banana-2.1-ext` |
| Nano Banana 2 | `gemini-3.1-flash-image-preview` (`nano-banana-2-ext`), `gemini-3.1-flash-image-preview-official` (`nano-banana-2`) |
| Nano Banana Lite | `gemini-3.1-flash-lite-image` (`nano-banana-2-lite`), `gemini-3.1-flash-lite-image-ext` (`nano-banana-2-lite-ext`) |
| Nano Banana Pro | `gemini-3-pro-image-preview` (`nano-banana-pro-ext`), `gemini-3-pro-image-preview-official` (`nano-banana-pro`) |
| Nano Banana | `gemini-2.5-flash-image-preview` (`nano-banana-ext`), `gemini-2.5-flash-image-preview-official` (`nano-banana`) |
| Imagen 4.0 | `imagen-4.0-apimart` |
| Seedream | `seedream-4.0`, `seedream-4.5`, `seedream-5-0-lite`, `seedream-5-0-pro`, `seedream-5-0-flash` |
| FLUX | `flux-kontext-pro`, `flux-kontext-max`, `flux-2-flex`, `flux-2-pro`, `flux-2-max`, `flux-3-image`, `flux-3-image-klein` |
| Hy-Image | `hy-image-v3.5-preview` |
| MAI-Image | `mai-image-2.6`, `mai-image-2.6-flash` |
| Qwen Image | `qwen-image-2.0`, `qwen-image-2.0-pro`, `qwen-image-3.0`, `qwen-image-3.0-pro` |
| Z-Image | `z-image-turbo` |
| Wan 2.7 | `wan2.7-image-pro`, `wan2.7-image` |
| Grok Imagine | `grok-imagine-1.5-apimart` (`grok-imagine-1.5-ext`), `grok-imagine-image`, `grok-imagine-image-quality`, `grok-imagine-image-2.0`, `grok-imagine-2.0-ext` |

Names in parentheses are APIMart aliases, which the plugin also accepts.
The plugin checks each model's sizes, resolutions, image counts and reference images before sending, so an invalid request costs nothing upstream. Model-specific fields, such as Seedream's `watermark` or FLUX's `seed`, go in the request body as APIMart documents them. Fields a model does not take, such as `user` or `style`, are dropped.
OpenAI-style requests also work: a pixel size such as `1024x1024` picks the nearest supported ratio and a resolution tier that covers it, `quality: "standard"` and `"hd"` become `medium` and `high`, and `image` or `images` count as reference images.
Send `response_format: "b64_json"` to get Base64 images; the gateway downloads them for you.

## Billing

GPT-Image-2.5 (`gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`) and `gpt-image-2-official` are priced by tokens. Every other model is priced per image.

- Token models have "Input token unit price" and "Output image token unit price". APIMart's input tokens do not separate text from reference images, so price input at the text rate for text-to-image only, or at the image rate if clients send reference images. At APIMart's GPT-Image-2.5 prices of 5 USD (text) and 30 USD (output) per million tokens, the expression is `tier("base", u("input_tokens") * 5 / 1000000 + u("output_tokens") * 30 / 1000000)`.
- Per-image models always have the image count. Depending on the model they also have the resolution tier, the number of reference images, the quality, the size, the version or prompt rewriting, so a price can depend on them. The price editor shows only the fields a model uses.
- Per-call pricing also works; the gateway then multiplies the call price by the requested image count.

When the request arrives, the gateway reserves quota for the requested images. GPT-Image-2.5 without an explicit `quality` reserves at the highest quality. When the task finishes, the gateway settles on the images APIMart returns, and a failed task is refunded.

## Example

```bash
curl https://your-gateway.example.com/v1/images/generations \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nano-banana-pro",
    "prompt": "A cozy reading nook by a rainy window, warm desk lamp, cinematic light",
    "size": "16:9",
    "resolution": "2K"
  }'
```

## Limits

- GPT-Image-2.5, `gpt-image-2-official`, GPT-Image 1 and 1.5, Hy-Image, Qwen Image 2.0 and the Grok models take reference images only as public http(s) URLs in `image_urls`. Uploading image files to `/v1/images/edits` for these models is rejected. Other models also take data URLs and uploaded files.
- Only GPT-Image models take a mask: a URL, a PNG data URL, or an uploaded `mask` file of at most 4 MB with an alpha channel, the size of the first reference image.
- The OpenAI endpoints wait for the image for up to `TASK_PLUGIN_PROTOCOL_TIMEOUT_SECONDS` (600 seconds by default) and then answer 504; the task still finishes and settles in the background. Raise client and proxy timeouts for slow models such as Seedream 5.0 Pro or 4K tiers.
- Image URLs come from APIMart and expire, usually after 24 to 72 hours. Download them, or ask for `b64_json`.
- Streaming, Midjourney and Grok layer or region editing are not supported.
