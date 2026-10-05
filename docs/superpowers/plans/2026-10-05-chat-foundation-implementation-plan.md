# C01 — Chat Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo chat local dùng CopilotKit: text streaming, New chat, Stop/Retry và một notice `Chưa kết nối` cho mọi technical failure.

**Architecture:** Next.js BFF chạy TypeScript CopilotRuntime/BuiltInAgent, model instance từ endpoint cấu hình riêng và InMemoryAgentRunner cho C01. Client dùng CopilotChat với app-owned view/controller/error projection. History durable và domain/tools/MCP thuộc C02–C05.

**Tech Stack:** Existing Node 24 LTS/pnpm 11.25.0/Next 16.3.8/React 19.3.0/TypeScript 6.0.3/Zod 4.6.5; thêm stable CopilotKit 1.77.0 với imports v2, AI SDK 6.0.300, OpenAI adapter 3.0.124, AG-UI client 1.0.1 và RxJS 7.8.1.

**Spec:** [C01 Chat Foundation](../specs/2026-10-05-chat-foundation-design.md). User đã cho chuyển sang writing-plans ngày 2026-10-05; chưa yêu cầu execute plan này. Đọc cả spec và plan khi triển khai.

**UI direction update:** [ChatGPT layout / white theme](../specs/2026-10-05-chat-white-ui-design.md) theo reference và yêu cầu user. Plan chỉ là handoff; user tự handle code. Theme trắng cố định thay quyết định browser light/dark trước đó. C01 có sidebar shell, C02 mới có history data/actions.

## Global Constraints

- Chỉ làm tại `E:/thucchienai/hackathon-starter-kit`, origin `baominh5xx2/template-codesdas`. Không đọc/thao tác repo thi `aitc2026-team-939-triplepeek`, secrets, tài liệu BTC hoặc config của nó.
- Một người local; không login/tenant endpoints, tenant switching/RBAC, billing hoặc Intelligence requirement.
- Public technical copy duy nhất **`Chưa kết nối`**; notice không là assistant message, không vào model context; không raw SDK/provider errors, stack traces, default error bubbles/toasts hoặc demo assistant fallback.
- Execution deadline **120_000 ms**; `maxOutputTokens: 2_048`, `maxRetries: 0`, `maxSteps: 1`; input **8_000 ký tự**, body **256 KiB**.
- Một execution active trên local runtime; khóa ở server lẫn client. Stop giữ partial/interrupted; Retry giữ user ID, tạo execution ID mới và bỏ failed partial khỏi model input.
- Runtime route `/api/copilotkit`, agent routing key **`default`**, v2 multi-route handler và provider `useSingleEndpoint={false}`.
- Model chỉ đọc `CHAT_MODEL_BASE_URL`, `CHAT_MODEL_ID`, `CHAT_MODEL_API_KEY`; Chat Completions; no-env/invalid chat config không crash app hoặc bật business features.
- C01 chỉ ephemeral transcript/runner, không localStorage/DB; không sửa Artifact/Run/Domain contracts để chat chạy.
- Core không import React/Next/CopilotKit SDK; integrations ở adapters/server/UI. Existing fixture APIs và production gating giữ nguyên.
- Đọc local Next guides trong `node_modules/next/dist/docs/` theo AGENTS trước khi viết implementation code.
- Dependencies exact stable pins và lockfile; không force peer conflicts, không cài MCP/parser/vector/UI-card dependencies vào C01.
- User hiện chỉ yêu cầu mình viết spec/plan và tự handle code. Không execute/spawn implementer. Preference subagent-driven/**gpt-6-luna** trước đó chỉ áp dụng nếu user sau này giao execution lại; dependency tasks trong handoff chạy tuần tự.
- Không đánh dấu checkbox hoặc claim test PASS trước khi execute. Commands/tests dưới đây là yêu cầu tương lai.

## SDK facts đã kiểm chứng khi viết plan

Metadata đọc từ official npm registry ngày 2026-10-05; published tarballs được đọc trong thư mục temp, không install vào app. CopilotKit runtime 1.77.0 dùng `ai ^6.0.104`/OpenAI provider `^3.0.36`; chọn patch stable 6.0.300/3.0.124 cùng generation. React/Zod peers chấp nhận baseline hiện tại. [Model integration](https://docs.copilotkit.ai/model-selection).

Published types/source xác nhận:

- `createCopilotRuntimeHandler({runtime, basePath, hooks})`; hooks `onRequest/onBeforeHandler/onResponse/onError` xử lý HTTP, không thay thế error events trong stream.
- BuiltInAgent classic nhận model instance và step/output/retry controls; AG-UI `FunctionMiddleware` nhận `(input, next) => Observable<BaseEvent>`.
- `CopilotChat` có `chatView`, `onError`, `onStop`, `inputValue/onInputChange`; provider có `onError`, `enableInspector`, `debug`. `CopilotChat` tự chọn submit handler bên trong, nên truyền top-level `onSubmitMessage` **không đủ** để thay send flow: custom `chatView` phải override view callback.
- SDK `useAgent`, `useCopilotKit`, `agent.setMessages`, `copilotkit.runAgent` và `stopAgent` dùng cho controller bridge. Không tự viết model loop. [Programmatic control](https://docs.copilotkit.ai/programmatic-control), [prebuilt UI](https://docs.copilotkit.ai/prebuilt-components).

Sau install ở Task 2, kiểm tra exports/types đúng pins; nếu metadata/source đã thay đổi phải ghi compatibility evidence vào `docs/dependencies.md`, không đổi architecture hoặc silently dùng incompatible major. Các transitive dependencies do upstream ship phải được audit trong lockfile; stable direct pins không có nghĩa mọi legacy transitive package đều cùng generation.

## File map và thứ tự

| Task | Files / unit | Deliverable |
|---|---|---|
| 1 | `src/contracts/chat.ts`, `src/server/chat/*`, readiness route | No-env-safe config/readiness, identity và public error policy |
| 2 | SDK deps, `src/adapters/llm/chat-model.ts`, `src/adapters/agents/{chat-runtime,chat-policy}.ts`, runtime route | Real SDK runtime/model flow, deadline/concurrency/error masking |
| 3 | `src/ui/chat/controller.ts`, `src/adapters/agents/chat-client.ts` | Send/Stop/Retry/New chat state + SDK bridge, generation fence |
| 4 | `src/ui/chat/*.tsx`, page/layout/CSS | Chat workspace, SDK view customization, single notice và accessible UX |
| 5 | test-only provider server, Playwright projects, docs/scripts | Browser integration/failure coverage, no-env/build/production gates, C02 handoff |

Unit tests `.test.ts` theo Vitest hiện có; thêm `.test.tsx` inclusion và per-file jsdom cho UI ở Task 4. Không đổi toàn bộ integration tests sang jsdom. Playwright config hiện dùng port 3000 nhưng chưa có browser specs/projects; Task 5 tạo baseline và các chat projects, không reuse server không rõ config.

## Review Focus

1. Abort/failure rồi provider phát token muộn: terminal state/transcript không đổi — Tasks 2, 3, 5.
2. Hai tabs hoặc double submit: server gate không release khi HTTP response vừa được tạo — Tasks 2, 3, 5.
3. Error sentinel nằm trong stream/SDK error surface: HTTP masking riêng không đủ — Tasks 2, 4, 5.
4. Retry sau partial không gửi partial/notice hoặc append thêm user message — Tasks 3, 5.
5. No-auth endpoint và client header spoofing: không dùng implicit OPENAI_API_KEY/forward browser authorization — Tasks 1, 2, 5.

## Task 1: Chat config, identity, readiness và error contract

**Files:**
- Create: `src/contracts/chat.ts`, `src/server/chat/config.ts`, `src/server/chat/identity.ts`, `src/server/chat/errors.ts`, `src/app/api/chat/readiness/route.ts`.
- Test: `tests/chat/config.test.ts`, `tests/chat/errors.test.ts`, `tests/integration/chat-readiness.test.ts`.
- Existing references: `src/server/env.ts`, `src/server/container.ts`, `src/contracts/common.ts`; không đổi behavior của chúng.

**Interfaces:**

```ts
export const CHAT_NOTICE = "Chưa kết nối";
export const CHAT_LIMITS = { inputChars: 8_000, bodyBytes: 262_144,
  deadlineMs: 120_000, outputTokens: 2_048, retries: 0, steps: 1 } as const;
export type ChatReadiness = { available: boolean; agentId: "default" };
export type ChatExecutionStatus = "idle" | "running" | "completed" | "failed" | "interrupted";
export type ChatModelConfig = { baseUrl: string; modelId: string; apiKey?: string };
export type ChatConfigResult = { available: true; config: ChatModelConfig }
  | { available: false; cause: "missing_config" | "invalid_config" };
export type ChatDiagnosticCode = "missing_config" | "invalid_config" | "provider_failed"
  | "stream_failed" | "timeout" | "conflict" | "invalid_request" | "render_failed";
export type ChatDiagnostic = { code: ChatDiagnosticCode; traceId: string;
  runId?: string; phase: "readiness" | "request" | "execution" | "render"; durationMs?: number };
export type ChatDiagnosticSink = (record: ChatDiagnostic) => void;
```

Contracts thuộc `src/contracts/chat.ts`, config types thuộc `config.ts`, diagnostic types thuộc `errors.ts`. `loadChatConfig(values: Record<string,string|undefined>): ChatConfigResult`; `getChatReadiness(result: ChatConfigResult): ChatReadiness`; `resolveLocalChatIdentity(): Scope`; `chatFailureResponse(status: number): Response`; `emitChatDiagnostic(sink: ChatDiagnosticSink, record: ChatDiagnostic): void`.

- [ ] **Step 1: Viết tests no-env/invalid config và public masking.** Import production functions từ files trên, test route bằng direct `GET()` như health test hiện có.

```ts
expect(loadChatConfig({})).toEqual({ available: false, cause: "missing_config" });
expect(loadChatConfig({ CHAT_MODEL_BASE_URL: "file:///private", CHAT_MODEL_ID: "m" }))
  .toEqual({ available: false, cause: "invalid_config" });
expect(loadChatConfig({ CHAT_MODEL_BASE_URL: "http://127.0.0.1:4010/v1", CHAT_MODEL_ID: "m" }))
  .toEqual({ available: true, config: { baseUrl: "http://127.0.0.1:4010/v1", modelId: "m" } });
expect(getChatReadiness(loadChatConfig({}))).toEqual({ available: false, agentId: "default" });
expect(resolveLocalChatIdentity()).toEqual({ userId: "local-operator", workspaceId: "local-workspace", trustedOperator: false });
expect(await chatFailureResponse(503).json()).toEqual({ code: "chat_unavailable", message: "Chưa kết nối" });
```

Thêm assertions: whitespace model/key, malformed URL/userinfo trong URL, no credential in readiness, diagnostic sink nhận đúng allowlisted fields và không nhận arbitrary raw error object. `GET` không gọi fetch/model; headers `Cache-Control: no-store`.

- [ ] **Step 2: Run failing tests.** `pnpm test -- tests/chat/config.test.ts tests/chat/errors.test.ts tests/integration/chat-readiness.test.ts`; expected missing modules/exports, không sửa test thành skip.
- [ ] **Step 3: Implement config/policy/readiness.** Zod safeParse riêng cho chat settings; trim values, HTTP(S), model nonempty, no URL userinfo; optional blank key thành absent. Missing pair → missing_config; malformed provided values → invalid_config. Giữ parsing riêng với existing `loadServerEnv`.

```ts
export function getChatReadiness(result: ChatConfigResult): ChatReadiness {
  return { available: result.available, agentId: "default" };
}
export function chatFailureResponse(status: number): Response {
  return Response.json({ code: "chat_unavailable", message: CHAT_NOTICE },
    { status, headers: { "Cache-Control": "no-store" } });
}
export function resolveLocalChatIdentity(): Scope {
  return { userId: "local-operator", workspaceId: "local-workspace", trustedOperator: false };
}
```

`emitChatDiagnostic` reconstructs allowlisted fields; không spread unknown objects. Readiness `GET()` gọi own config loader và Response.json safe DTO; không `process.env` trong client/shared contracts, không đổi `APP_MODE` hoặc global feature flags.

- [ ] **Step 4: Run tests và baseline env test.** Commands trên + `pnpm test -- tests/contracts/env-errors.test.ts tests/integration/health.test.ts`; expected PASS khi execute.
- [ ] **Step 5: Commit exact Task 1 files.** `git commit -m "feat: add isolated chat readiness and failure policy"`; stage chỉ create/test paths của task.

## Task 2: Configured model + SDK runtime có execution policy

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `docs/dependencies.md`, `.env.example` (thêm three chat vars nếu file đã có; tạo nếu chưa có).
- Create: `src/adapters/llm/chat-model.ts`, `src/adapters/agents/chat-runtime.ts`, `src/adapters/agents/chat-policy.ts`, `src/server/chat/http.ts`, `src/app/api/copilotkit/[[...slug]]/route.ts`.
- Test/helpers: `tests/chat/model.test.ts`, `tests/chat/runtime-policy.test.ts`, `tests/integration/chat-runtime.test.ts`, `tests/helpers/chat-provider.ts`.

**Interfaces:** consumes Task 1 config/limits/diagnostics. Produces:

```ts
export function createChatModel(config: ChatModelConfig, fetchImpl?: typeof fetch): LanguageModel;
export type ChatExecutionGate = {
  acquire(threadId: string, runId: string): boolean;
  release(threadId: string, runId: string): void;
};
export function createExecutionGate(): ChatExecutionGate;
export function createChatPolicy(options: { gate: ChatExecutionGate; diagnostics: ChatDiagnosticSink;
  deadlineMs?: number }): Middleware;
export function createChatRuntime(options: { model: LanguageModel; diagnostics: ChatDiagnosticSink;
  runner?: AgentRunner; deadlineMs?: number }): CopilotRuntime;
export function createChatRequestHandler(config: ChatConfigResult,
  diagnostics: ChatDiagnosticSink): (request: Request) => Promise<Response>;
```

SDK types chỉ nằm trong adapter files. Test helper `createChatProviderFixture(options?: { port?: number; scenario?: "success"|"reject"|"partial-fail"|"slow"; rejectStatus?: 401|429|500 }): Promise<{ baseUrl: string; requests: Array<{body: unknown; authorization: string|null; aborted: boolean}>; close(): Promise<void> }>` chạy local HTTP on random loopback port khi không truyền port. Helper mô phỏng **provider wire format**, không thay BuiltInAgent hoặc app runtime bằng fake agent.

- [ ] **Step 1: Viết tests runtime/model và execution gate.** Định nghĩa fixture bằng Node HTTP server: `/v1/chat/completions`, OpenAI Chat Completions SSE chunks và `[DONE]`; reject trả 401 JSON chứa sentinel `RAW_SECRET_ERROR`; partial-fail phát một delta rồi invalid/error stream; slow giữ socket tới abort. Log captured input để kiểm tra protocol/model/context. `close()` hủy timers và sockets do fixture sở hữu trước khi chờ server close; test lỗi/abort không được treo teardown.

```ts
const gate = createExecutionGate();
expect(gate.acquire("t1", "r1")).toBe(true);
expect(gate.acquire("t2", "r2")).toBe(false);
gate.release("t1", "stale");
expect(gate.acquire("t2", "r2")).toBe(false);
gate.release("t1", "r1");
expect(gate.acquire("t2", "r2")).toBe(true);
expect(await createChatRequestHandler(loadChatConfig({}), () => {})(new Request("http://127.0.0.1:3000/api/copilotkit/info")))
  .toHaveProperty("status", 503);
```

Actual SDK integration request body `RunAgentInput`: UUID thread/run IDs, state `{}`, messages gồm user text, tools/context `[]`, forwardedProps `{}`; POST `/api/copilotkit/agent/default/run`, Origin same app. Response SSE chứa successful text/terminal. Reject/partial-fail output không chứa raw sentinel. Model HTTP path là `/chat/completions`, no Responses; no-auth không gửi Authorization kể cả `OPENAI_API_KEY` test sentinel đã set; configured own key gửi đúng key. Fake timers verify policy deadline exactly 120_000 and release/fence; cross-origin/oversized/malformed requests reject trước SDK/model.

- [ ] **Step 2: Run RED rồi install exact compatible SDKs cho implementation task.** Tests đầu tiên phải fail missing exports; sau đó:

```powershell
pnpm add --save-exact @copilotkit/react-core@1.77.0 @copilotkit/runtime@1.77.0 ai@6.0.300 @ai-sdk/openai@3.0.124 @ag-ui/client@1.0.1 rxjs@7.8.1
```

Không thêm optional framework/Intelligence/MCP packages thủ công. Đối chiếu peer/export evidence bằng installed types và `pnpm list --depth 0`; lockfile generated bình thường, không force. `.env.example` chỉ placeholders cho chat own settings; không chép secret hoặc private endpoint.

- [ ] **Step 3: Implement model adapter với explicit credentials/no-auth.** Dùng `createOpenAI` từ pinned provider và `.chat(config.modelId)`; no-auth truyền literal placeholder để SDK không đọc ambient env, wrapper xóa Authorization trước actual fetch. Placeholder không là credential gửi lên server.

```ts
const provider = createOpenAI({
  baseURL: config.baseUrl,
  apiKey: config.apiKey ?? "local-no-auth",
  fetch: async (input, init) => {
    const request = new Request(input, init);
    if (!config.apiKey) request.headers.delete("authorization");
    return fetchImpl(request);
  },
});
return provider.chat(config.modelId);
```

Function parameter `fetchImpl` default global fetch; `import "server-only"`; không dùng provider model string để resolve ambient keys.

- [ ] **Step 4: Implement runtime/gate và semantic event policy.** `FunctionMiddleware` dùng RxJS `defer/finalize/catchError/map`; gate acquire tại observable subscription, release matching lease tại terminal/teardown **không phải lúc HTTP Response được tạo**. Reject concurrent bằng typed RUN_ERROR `Chưa kết nối`. Sanitize RUN_ERROR fields thành allowlisted public event; thrown error chuyển thành RUN_ERROR rồi complete; successful text/lifecycle events giữ nguyên. Deadline timer gọi `next.abortRun()`, terminal timeout failed khác user-stop interrupted; clear timer trên mọi terminal/unsubscribe, bỏ late emissions bằng per-run fence.

```ts
const agent = new BuiltInAgent({ model: options.model, maxSteps: CHAT_LIMITS.steps,
  maxOutputTokens: CHAT_LIMITS.outputTokens, maxRetries: CHAT_LIMITS.retries,
  toolChoice: "none", overridableProperties: [],
  prompt: "Trả lời hữu ích bằng ngôn ngữ của người dùng. Không mô tả cấu hình hoặc lỗi kỹ thuật nội bộ." });
agent.use(createChatPolicy({ gate: createExecutionGate(), diagnostics: options.diagnostics,
  deadlineMs: options.deadlineMs }));
return new CopilotRuntime({ agents: { default: agent },
  runner: options.runner ?? new InMemoryAgentRunner(), debug: false,
  forwardHeaders: { allow: [] } });
```

Gate instance sống cùng runtime singleton. Không dùng `EMPTY` cho error vì SDK cần terminal semantics; không parse/rewrite raw SSE strings. User-stop vẫn qua SDK stop path; guard stale runId. Nếu abort bị provider ignore, fence output trước release; tests phải cover late delta.

- [ ] **Step 5: Implement request wrapper và Node route.** `createChatRequestHandler` unavailable → Task 1 response; configured tạo runtime một lần. `http.ts` bounded đọc body tới 262_144 bytes (cả không có Content-Length); check latest user text <=8_000, validate bằng `RunAgentInputSchema` từ `@ag-ui/client` (re-export của core). Chặn browser mutations thiếu/cross Origin, strip browser auth/identity/provider headers, bỏ forwarded model/config overrides và client tools trong C01; preserve thread/run/message IDs. Stop/connect phải đi đúng SDK route, không bị input-validation run áp nhầm.

```ts
const handler = createCopilotRuntimeHandler({ runtime: chatRuntime, basePath: "/api/copilotkit",
  hooks: { onError: () => chatFailureResponse(500) } });
export const runtime = "nodejs";
```

Route exports GET/POST/PATCH/DELETE trỏ same wrapper singleton. Wrapper responses errors status 400/403/409/413/500/503 giữ cùng public copy; normal protocol unsupported endpoints không expose raw bodies. `onError` hook mask HTTP; middleware ở Step 4 mask streamed errors. Request replay sau bounded read dùng reconstructed Request với original signal.

- [ ] **Step 6: Verify.** `pnpm test -- tests/chat/model.test.ts tests/chat/runtime-policy.test.ts tests/integration/chat-runtime.test.ts`; `pnpm check`; expected actual SDK stream/provider tests PASS, no mismatched exports. No-env readiness test vẫn không instantiate runtime/model.
- [ ] **Step 7: Commit Task 2 exact files.** `git commit -m "feat: wire local chat model and guarded CopilotKit runtime"`.

## Task 3: Client controller và SDK lifecycle bridge

**Files:** create `src/ui/chat/controller.ts`, `src/adapters/agents/chat-client.ts`; test `tests/chat/controller.test.ts`, `tests/chat/client-bridge.test.ts`.

**Interfaces:** client-safe contracts thuộc Task 1. Controller text messages độc lập SDK type; bridge là nơi chuyển qua AG-UI `Message`:

```ts
export type ChatTextMessage = { id: string; role: "user"|"assistant"; content: string };
export type ChatSnapshot = { threadId: string; messages: ChatTextMessage[]; draft: string;
  available: boolean; status: ChatExecutionStatus; pending: boolean; notice: boolean };
export type ChatRunRequest = { threadId: string; runId: string; messages: ChatTextMessage[] };
export type ChatRunSink = { started(): void; messages(messages: ChatTextMessage[]): void;
  terminal(status: "completed"|"failed"|"interrupted"): void };
export type ChatClientPort = { run(request: ChatRunRequest, sink: ChatRunSink): Promise<void>;
  stop(): void; reset(threadId: string): void };
export type ChatController = { getSnapshot(): ChatSnapshot; subscribe(fn: () => void): () => void;
  setDraft(value: string): void; setAvailable(value: boolean): void; fail(): void;
  send(): Promise<boolean>; stop(): Promise<void>; retry(): Promise<boolean>;
  newChat(): Promise<void>; dispose(): void };
export function createChatController(options: { port: ChatClientPort; uuid: () => string;
  available: boolean }): ChatController;
```

`chat-client.ts`: `type CopilotChatBindings = {agent: ReturnType<typeof useAgent>["agent"]; copilotkit: ReturnType<typeof useCopilotKit>["copilotkit"]}` và `createCopilotChatClient(bindings: CopilotChatBindings): ChatClientPort`; SDK hooks ở type imports, không gọi trong factory. Không cast unknown để tránh SDK mismatch.

Thêm `ChatClientBinding = {port: ChatClientPort; attach(client: ChatClientPort): () => void}` và `createChatClientBinding(): ChatClientBinding` trong cùng adapter: stable forwarding port cho workspace tạo controller trước provider; unattached run reject an app-safe error, không fake success; attach cleanup detach đúng instance. Test helper `createControlledChatPort()` ở `tests/helpers/chat-client.ts` trả `{port, requests, emitStarted, emitMessages, finish, stopCount, resetThreads}`; một request active, controlled terminal/promise để test race.

- [ ] **Step 1: Viết deterministic state tests.** Helper implement plain port, không fake SDK protocol; production bridge test dùng mocked SDK methods có đúng typed shape.

```ts
const h = createControlledChatPort();
let n = 0;
const c = createChatController({ port: h.port, uuid: () => `id-${++n}`, available: true });
c.setDraft("Xin chào");
const first = c.send();
expect(await c.send()).toBe(false);
expect(h.requests).toHaveLength(1);
h.emitStarted();
h.emitMessages([{ id: h.requests[0].messages[0].id, role: "user", content: "Xin chào" },
  { id: "a1", role: "assistant", content: "partial" }]);
h.finish("failed");
await first;
const retry = c.retry();
expect(h.requests[1].messages).toEqual(h.requests[0].messages);
expect(h.requests[1].runId).not.toBe(h.requests[0].runId);
expect(c.getSnapshot().messages.filter(m => m.role === "user")).toHaveLength(1);
h.finish("completed");
await retry;
```

Thêm assertions: unavailable/blank/>8_000 chars không dispatch và giữ draft; Stop giữ partial/interrupted/no notice; late sink sau terminal/reset ignored; New chat chờ stop-finalization rồi đổi thread; old retry invalidated khi gửi/newChat; rejection trước started rollback optimistic user message/restore draft, failure sau started giữ accepted user ID cho Retry; dispose unsubscribe/abort. Bridge tests verify setMessages full prefix, explicit runId, no addMessage second time, stopAgent call, binding attach/detach/unattached failure, finalized subscription cleanup và safe handling onRunFailed/onRunErrorEvent.

- [ ] **Step 2: RED.** `pnpm test -- tests/chat/controller.test.ts tests/chat/client-bridge.test.ts`; expected missing exports.
- [ ] **Step 3: Implement controller state/race policy.** Synchronous pending fence trước await; giữ accepted user message ID và pre-turn checkpoint cho retry; sink closure bound generation/run; terminal chỉ một lần. Use immutable snapshots cho `useSyncExternalStore`; pending bao gồm stopping/resetting, status chỉ spec statuses. Stop flag phân biệt explicit user cancel với failed timeout. Run promise settle là teardown gate, không chỉ `agent.isRunning=false` tức thời.

```ts
const request: ChatRunRequest = { threadId: snapshot.threadId, runId: options.uuid(),
  messages: nextMessages };
const generation = activeGeneration;
const sink: ChatRunSink = {
  started: () => { if (generation === activeGeneration && !terminalSeen) accepted = true; },
  messages: messages => { if (generation === activeGeneration && !terminalSeen) acceptMessages(messages); },
  terminal: status => { if (generation === activeGeneration && !terminalSeen) acceptTerminal(status); },
};
```

`acceptMessages(messages: ChatTextMessage[]): void` và `acceptTerminal(status: "completed"|"failed"|"interrupted"): void` là closures trong `createChatController`; `accepted` là per-attempt boolean chỉ set từ started event. Terminal marks internal attempt ended, failed sets notice, completed/interrupted clears appropriately; pre-start rejection rollback optimistic append. `fail()` đặt notice và chặn send, nhưng không release pending run trước promise teardown. Late cleanup/finally không overwrite new generation. Controller never store CHAT_NOTICE in messages.

- [ ] **Step 4: Implement SDK port adapter.** Set thread and `agent.setMessages(request.messages)` trước SDK run; subscribe message/lifecycle events, RUN_STARTED gọi `sink.started`, project text messages thôi. `copilotkit.runAgent({agent, runId: request.runId})` theo pinned core params; Stop gọi `copilotkit.stopAgent({agent})`. Promise rejection normalizes failed, user abort normalizes interrupted; ensure unsubscribe trong finally, no raw console logs. `reset` set thread + clear messages sau prior promise settle; cleanup old callbacks.

```ts
agent.setMessages(request.messages);
const result = await copilotkit.runAgent({ agent, runId: request.runId });
void result;
```

Không dùng direct low-level agent.runAgent làm agent loop thay thế. Mỗi run sink nhận safe text projections và app statuses; no errors object stored in controller. Retry context chỉ checkpoint + original user message.

- [ ] **Step 5: Verify GREEN + types.** Commands RED trên + `pnpm check`; tất cả race/duplicate assertions PASS.
- [ ] **Step 6: Commit Task 3 files.** `git commit -m "feat: add race-safe chat send stop and retry controller"`.

## Task 4: Workspace UI và SDK view/error customization

**Files:** create `src/ui/chat/{workspace,sidebar-shell,chat-panel,connection-notice,error-boundary}.tsx`, `src/ui/chat/use-controller.ts`; modify `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `vitest.config.ts`; tests `tests/chat/workspace.test.tsx`, `tests/chat/panel.test.tsx`.

**Interfaces:** `ChatWorkspace(): ReactElement`; `SidebarShell({open,onClose,onNewChat,pending}: {open:boolean;onClose:()=>void;onNewChat:()=>void;pending:boolean}): ReactElement`; `ChatPanel({controller}: {controller: ChatController}): ReactElement`; `ConnectionNotice({visible,onRetry}: {visible:boolean;onRetry:()=>void}): ReactElement|null`; `ChatErrorBoundary({children,onRetry}: {children: ReactNode;onRetry:()=>void})` fallback shell; `useChatController(controller: ChatController): ChatSnapshot` using useSyncExternalStore. Workspace tạo một controller với Task 3 binding port trước provider; below-provider bridge attach actual SDK port khi discovery ready. Workspace/controller là một nguồn draft/transcript/notice, không tạo controller thứ hai. SidebarShell chỉ shell/nav, không fetch hoặc giả lập history; workspace giữ open state, desktop mở mặc định/mobile đóng, breakpoint 1024px theo UI spec.

- [ ] **Step 1: Viết jsdom component tests.** Thêm file directive `// @vitest-environment jsdom`; Vitest include cả `.test.ts` và `.test.tsx`. Dùng Testing Library existing dependency và `vi.stubGlobal("fetch", ...)` cho readiness; SDK renderer mock chỉ trong isolated UI tests, Task 5 kiểm chứng real SDK.

```tsx
render(<ConnectionNotice visible={true} onRetry={vi.fn()} />);
expect(screen.getAllByText("Chưa kết nối")).toHaveLength(1);
expect(screen.getByRole("status")).toHaveTextContent("Chưa kết nối");
```

Tests workspace: `{available:false}` → không mount SDK/provider, editable draft + disabled Send, Retry readiness không append messages; reject/malformed readiness cùng notice. ErrorBoundary throws sentinel → fallback copy không sentinel; notice không duplication với provider/chat onError cùng firing. Panel tests Send/Retry disable khi pending; Stop và New chat vẫn gọi được trong running (New chat abort/chờ teardown theo controller, không reset ngay). Chặn lặp Stop/New chat trong teardown, kiểm tra Enter/Shift+Enter/IME, Copy, hide edit/regenerate/voice/upload/Inspector controls. Sidebar test không fake history, New chat dùng cùng controller; drawer Escape/close trả focus, không render feature controls chưa sẵn. `pending` prop không tự disable New chat chỉ vì model đang chạy.

- [ ] **Step 2: RED.** `pnpm test -- tests/chat/workspace.test.tsx tests/chat/panel.test.tsx` expected missing components (sau mở include, không accept zero tests found).
- [ ] **Step 3: Implement readiness-gated provider và safe notice.** Workspace fetch own endpoint, failure normalized boolean, AbortController cancel stale requests/unmount; unreadiness không mount failing SDK. Hydrated UUID tạo client-side khi initialization ready, tránh SSR mismatch. Workspace white theme và outer fallback composer để draft vẫn sửa được no-env; cả fallback và SDK-mounted view dùng cùng tokens.

```tsx
<CopilotKit runtimeUrl="/api/copilotkit" agent="default" useSingleEndpoint={false}
  enableInspector={false} debug={false} onError={() => controller.fail()}>
  <ChatPanel controller={controller} />
</CopilotKit>
```

Snippet là provider policy; workspace controller dùng stable binding port, actual SDK hooks chỉ gọi trong bridge child/provider context. Bridge effect attach port + setAvailable khi agent ready; detach/stop trên cleanup, không release execution mới khi run cũ chưa settle. Notice đọc một controller snapshot; outer error fallback cũng dùng controller.fail. ErrorBoundary bao provider/panel; callbacks không throw hoặc log raw event.

- [ ] **Step 4: Implement custom chatView/controller wiring.** Slot replacement nhận actual `CopilotChatViewProps` derived bằng ComponentProps từ exported `CopilotChatView`; render `<CopilotChatView>` với controller snapshot/messages/status/actions sau khi spread SDK view props. Override submit/input/stop/messages/isRunning để SDK built-in submit không double-dispatch. Replace/hide user edit và assistant regenerate toolbar slots; giữ Markdown/code/Copy và scroll view mặc định. Welcome greeting phải xuất hiện dù explicit ephemeral thread được truyền; không thêm greeting vào transcript.

```tsx
<CopilotChatView {...sdkViewProps} messages={snapshot.messages}
  isRunning={snapshot.pending} inputValue={snapshot.draft}
  onInputChange={controller.setDraft}
  onSubmitMessage={() => { void controller.send(); }}
  onStop={() => { void controller.stop(); }} />
```

Controller hook reads SDK useAgent/useCopilotKit only in bridge child, stable port/controller refs; render feedback không thay state trong render. Override input slot để enforce IME/input-limit/draft behavior và pending/no-env disabled; latest SDK callback clearInput không làm mất failed draft. Copy uses clipboard API và safe product feedback; failed clipboard action dùng same technical notice.

- [ ] **Step 5: Integrate entry/style/UX.** Page renders workspace; root import `@copilotkit/react-core/v2/styles.css`; lang `vi`, title starter. Map semantic colors từ White UI spec sang pinned SDK theme variables tại workspace scope, `color-scheme: light`; không có prefers-color-scheme dark overrides. Full height shell (`100dvh`), sidebar 280px/desktop collapse/mobile dialog, cột transcript/composer tối đa 768px, min-width 0; composer chiếm hàng flex riêng, safe-area inset, không che message cuối. System font tiếng Việt, user bubble xám phải/assistant plain text trái. Auto-scroll only sticky-bottom; when detached show scroll-to-bottom; focus không theo token. Exact labels từ spec; sidebar shell có thật nhưng chưa có history list, no vendor debug UI.
- [ ] **Step 6: Verify.** UI tests + `pnpm check`; kiểm tra server-only import boundary trong client bundle và SSR/no-env renders không crash.
- [ ] **Step 7: Commit Task 4 files.** `git commit -m "feat: build CopilotKit chat workspace with unified notice"`.

## Task 5: Real SDK browser flow, failure matrix và release handoff

**Files:** create `tests/helpers/chat-provider-server.ts`, `tests/e2e/baseline.spec.ts`, `tests/e2e/chat-no-env.spec.ts`, `tests/e2e/chat-live.spec.ts`, `tests/e2e/chat-failures.spec.ts`, `tests/e2e/chat-production.spec.ts`, `scripts/chat-smoke.ts`; modify `playwright.config.ts`, `next.config.ts`, `.gitignore`, `package.json`, `docs/api-contracts.md`, `docs/code-structure.md`, `docs/README.md`, PRD/spec status chỉ khi checks đạt.

**Interfaces:** helper server reuses Task 2 fixture semantics; Node process listens test-only `127.0.0.1:4310`, routes `/v1/chat/completions` và `/test/scenario`/`/test/requests` điều khiển từ Playwright. Scenario enum như Task 2; bounded fixture controls dùng test process, không app route/feature flag/provider fallback.

- [ ] **Step 1: Viết e2e RED với actual app/runtime/SDK.** Two isolated Next dev servers: no-env port **3100** với chat vars explicit empty; configured port **3101** baseURL `http://127.0.0.1:4310/v1`, model `test-chat`, key empty. Provider fixture tách process. Playwright `reuseExistingServer:false`, `workers:1` cho acceptance command/config để failure scenarios không đổi provider state đồng thời; teardown owns only child processes của test run. Tạo `baseline` project port 3000, `testMatch: baseline.spec.ts`: health 200/skeleton, domains 4 manifests, dev demo/rows 200, runs 501 theo integration contracts hiện có. Không gọi baseline đã tồn tại hoặc accept zero tests.

```ts
await page.goto("/");
await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
await expect(page.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled();
await expect(page.getByText("RAW_SECRET_ERROR")).toHaveCount(0);
```

No-env test giữ editable draft và không có `/agent/default/run` request. Live tests send hai lượt + captured provider history; assert one user ID per send/Retry, actual streamed text; Stop/New chat and late delta, retry checkpoint, reload reset. Failure tests drive 401/network/partial-fail/timeout/discovery/info failure và renderer fallback; assert one notice/no sentinel in DOM/API/stream/app-emitted console events, terminal/loading recovery. Timeout deadline unit fake timers ở Task 2; browser timeout case drop stream/reject để suite không sleep 120 seconds.

Responsive tests viewport 390×844, 768×1024, 1440×900 và 1920×1080: sidebar/drawer đúng breakpoint, no x overflow/composer visible; Enter/Shift+Enter/IME, drawer focus trap/restore/Escape. Emulate dark preference và assert computed canvas/text/composer/bubble colors vẫn đúng white tokens với actual SDK mounted; no-env fallback dùng cùng theme. Test 200% zoom, long URLs/code, long stream then scroll up keeps position/focus, button về cuối; Copy clipboard. Two browser contexts send concurrent, second rejected notice, first finishes normally. Repeated error+Retry không spam. Route mocks chỉ dùng transport outage cases; success/end-to-end không thay runtime bằng mocked AG-UI events.

- [ ] **Step 2: Define harness/scripts.** Add `chat:smoke: tsx scripts/chat-smoke.ts`; script dùng explicit `CHAT_SMOKE_URL` default `http://127.0.0.1:3100`, check health/readiness; if readiness unavailable verify runtime 503/copy and no crash, if available perform UUID text run and verify successful stream terminal or mask failure. Không auto boot provider hoặc đọc unrelated env/secrets. Controlled provider command:

```powershell
pnpm exec tsx tests/helpers/chat-provider-server.ts
```

Command trên dùng khi inspect fixture độc lập; stop process mình vừa chạy trước Playwright. Automated harness tự launch fixture, không launch thêm một server thủ công cùng port.

`playwright.config.ts` webServer array bổ sung provider và hai chat app servers; commands `pnpm dev --port 3100`/`pnpm dev --port 3101`, project baseURLs tương ứng. `chat-no-env` match no-env spec; `chat-live` match live/failures specs; baseline match duy nhất baseline spec. Startup health `/api/health`/fixture health, timeout 60_000. Các dev servers dùng `distDir` riêng (`.next-e2e-baseline`, `.next-e2e-no-env`, `.next-e2e-live`) qua server-only `NEXT_TEST_DIST_DIR` trong `next.config.ts`, default vẫn `.next`; thêm paths vào `.gitignore`. Điều này tránh nhiều `next dev` tranh lock hoặc ghi đè production build. Vì env vars inherited, overwrite all three chat vars cho no-env/baseline. Không set test mode trong production app để đổi agent/provider. Occupied ports làm harness fail rõ, không kill server/container không thuộc test run.

Tạo `chat-production` project port **3102**, match `chat-production.spec.ts`; server command `pnpm exec next start --hostname 127.0.0.1 --port 3102`, dùng `.next` từ `pnpm build`, `NEXT_TEST_DIST_DIR` empty và three chat vars empty. Browser spec xác nhận notice/disabled Send; HTTP assertions readiness false, runtime info 503 với copy đúng, `/api/demo/document-review` 503 và `/api/runs` POST 501. Dùng cùng spec để kiểm tra production gating thật thay vì chỉ đổi NODE_ENV trong unit test.

- [ ] **Step 3: Implement acceptance fixes và production-safe docs.** Chỉ sửa failures trong Task 1–4 boundaries; không weaken assertions để pass. API docs thêm readiness/runtime và mask policy; code structure/handoff ghi C01 ephemeral limitation, C02 swap runner, no tools/MCP yet. Existing fixtures giữ dev/test only; provider fixture dưới tests không vào production registry.

```ts
const readiness = await fetch(new URL("/api/chat/readiness", baseUrl)).then(r => r.json());
if (!readiness.available) {
  const response = await fetch(new URL("/api/copilotkit/info", baseUrl));
  if (response.status !== 503 || (await response.json()).message !== "Chưa kết nối")
    throw new Error("chat_smoke_unavailable_contract_failed");
}
```

`baseUrl` là parsed CHAT_SMOKE_URL trong `scripts/chat-smoke.ts`; live branch dùng same valid RunAgentInput body như Task 2, không fake response. Smoke CLI summary chỉ readiness/result/check counts; no credentials/raw model output/errors.

- [ ] **Step 4: Run required gates once; rerun chỉ khi sửa/failure.**

```powershell
pnpm check
pnpm test
pnpm domain:validate
pnpm build
pnpm exec playwright test --project=chat-no-env --project=chat-live --project=chat-production
pnpm e2e --project=baseline
git diff --check
```

Expected PASS khi execute. Production project chạy built app không chat config: chat notice/no runtime crash và fixture APIs production 503. `pnpm build` phải chạy trước Playwright vì harness có production server; nếu chạy RED trước implementation, build baseline trước và kỳ vọng fail đúng missing chat behavior. Controlled provider checks là automated integration, không claim live public model. Live own endpoint smoke optional khi được config; ghi limitation nếu chưa kiểm tra live endpoint. Build và automated checks không cần API key.

- [ ] **Step 5: Commit/handoff.** Stage exact changed C01 code/tests/docs; `git commit -m "test: verify chat streaming recovery and no-env release gates"`. Report checks/limitations, cập nhật C01 completed chỉ sau acceptance; confirm đúng origin/branch trước user-authorized push. Không push repo thi.

## Coverage self-review và execution handoff

| Spec coverage | Task |
|---|---|
| Local scope/no-env/config/model/protocol | 1–2 |
| Real SDK runtime, request validation, concurrency/deadline | 2 |
| Transcript IDs, Stop/Retry/New chat/late-event fences | 3, integration ở 5 |
| Exact notice, no error leaks/default surfaces | 1–2, 4–5 |
| Chat layout/labels/keyboard/mobile/scroll/Copy | 4–5 |
| Ephemeral limitation và C02/C03 handoff | 3, 5 |
| Existing build/contracts/fixture production gating | 1, 5 |

Plan đã self-review về spec coverage, type/interface consistency và placeholders. Các checkbox còn unchecked; không có test results từ bước viết plan. User tự handle code; mình chỉ viết spec/plan. Preference subagent-driven với gpt-6-luna giữ để tham khảo nếu sau này user giao execution lại. Plan này chưa được execute hoặc duyệt như một kết quả implementation.
