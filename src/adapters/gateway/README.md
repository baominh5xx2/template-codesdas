# Gateway adapter: text, search, image, video, TTS, STT, embeddings

A server-only connector to the OpenAI-compatible gateway (default `https://api.thucchien.ai`, LiteLLM). It is configured separately from the chat model (`CHAT_MODEL_*`).

```sh
AI_GATEWAY_API_KEY=sk-...                     # required; without it every call throws gateway_unavailable
# AI_GATEWAY_BASE_URL=https://api.thucchien.ai
# MEDIA_DIR=.data/media                        # where saveMedia writes files (gitignored)
```

Change default models in `defaults.ts`. Each call can also pass its own `model`.

## Usage (from a route handler, business tool, or server code)

```ts
import { getGateway } from "@/adapters/gateway";
import { getMediaStorage } from "@/adapters/storage/local-file-storage";

const ai = getGateway();
const media = getMediaStorage();

// Text, JSON output, web search
const { text } = await ai.chat({ messages: [{ role: "user", content: "Xin chào" }] });
const { value } = await ai.chatJson({ messages, schema: z.object({ score: z.number() }) });
const { text: answer, citations } = await ai.chat({ messages, search: true });

// Image → file → URL /api/media/<key>
const image = await ai.generateImage({ prompt: "Phố cổ Hội An, mưa", aspectRatio: "16:9" });
const { url } = await media.saveMedia(image.bytes, image.mimeType);

// Video (Veo, billed as soon as it is created): one call, or start/poll/download yourself
const video = await ai.generateVideo({ prompt: "...", seconds: 4, onStatus: (job) => console.log(job.status) });
await media.saveMedia(video.bytes, video.mimeType);

// Voice
const speech = await ai.speak({ text: "Xin chào các bạn", voice: "Kore" });          // mp3
const { text: transcript } = await ai.transcribe({ audio: { bytes, mimeType: "audio/webm" }, language: "vi" });

// Embeddings, spend
const { vectors } = await ai.embed({ input: ["a", "b"] });
const info = await ai.keyInfo();
```

## Behaviour

- **Retries:** 429, 5xx, timeouts and network errors are retried up to 3 times with exponential backoff, and `retry-after` is honoured. The video `start` call is retried only on 429, because it is billed as soon as the job is created.
- **Concurrency:** at most 4 requests run at once per process. The gateway allows 10 per key, or 5 with a test key.
- **Errors:** failures throw a `GatewayError` with a `code` (`gateway_auth`, `gateway_rate_limited`, `gateway_bad_request`, `gateway_timeout`, `gateway_video_failed`, …). `message` is the code and never contains the key. `detail` holds a 300-character upstream hint for server logs. Chat UI still shows only `Chưa kết nối`.
- **Cost:** results include `cost`, taken from `x-litellm-response-cost`.
- **Not provided:** Suno has no API (web account only), and image editing is not documented by the gateway.
