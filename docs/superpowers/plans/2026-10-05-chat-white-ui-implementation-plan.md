# ChatGPT-style White Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo workspace chat giống bố cục ChatGPT trong ảnh user, theme trắng cố định, dùng CopilotKit và không đổi lifecycle đã chốt.

**Architecture:** App shell sở hữu sidebar/header và layout; CopilotChat cung cấp agent/chat integration, custom chatView dùng SDK message/scroll renderers và app composer. Một controller C01 sở hữu transcript/draft/notice; UI không gọi model hoặc tạo agent loop mới. Sidebar C01 chỉ navigation shell, history có dữ liệu thuộc C02.

**Tech Stack:** Bun 1.4.2 package manager, Node 24 LTS runtime, baseline Next.js 16.3.8/React 19.3.0/TypeScript 6.0.3, plain scoped CSS, CopilotKit 1.77.0 imports v2 từ C01 Task 2; existing Vitest/Testing Library/Playwright. Không thêm Tailwind, icon library, font CDN hoặc component framework chỉ cho UI này.

**Spec:** [Chat white UI design](../specs/2026-10-05-chat-white-ui-design.md), [C01 technical spec](../specs/2026-10-05-chat-foundation-design.md), [C01 implementation plan](2026-10-05-chat-foundation-implementation-plan.md). User yêu cầu viết plan ngày 2026-10-05; **user tự handle code, mình chỉ viết docs**.

Ngày hoàn tất plan: **2026-10-06**; filename giữ ngày bắt đầu 2026-10-05.

## Global Constraints

- Repo duy nhất `E:/thucchienai/hackathon-starter-kit`; không đọc/thao tác repo thi, secrets/config/tài liệu của nó.
- White theme cố định kể cả OS/browser dark preference. Không theme switcher, gradient, glass hoặc landing hero.
- Branding **Hackathon Starter Kit**; không copy logo/tên ChatGPT hoặc tạo account/subscription menu giả.
- Main `#FFFFFF`, sidebar `#F9F9F9`, composer/code `#F4F4F4`, user bubble `#F1F1F1`, hover `#ECECEC`, text `#171717`, muted `#666666`, border `#E5E5E5`, Send/Stop `#171717`/`#FFFFFF`, focus `#2563EB`.
- Sidebar **280px**, desktop breakpoint **1024px**, header **56px** desktop/**52px** nhỏ; transcript/composer cùng cột tối đa **768px**, padding ngang **24px** desktop/**16px** nhỏ.
- Composer cách đáy **24px** desktop/**12px + safe-area** nhỏ, radius **24px**; user bubble radius **20px**, width max `min(85%, 640px)`, padding **12px 16px**; textarea **48–200px**; touch targets **44×44px**.
- System sans hỗ trợ tiếng Việt; body **16px/1.65**, navigation **14px**, welcome **32px/28px**, weight **600**; message gap **24px**.
- Copy chính xác: `Bạn muốn hỏi gì?`, `Nhập tin nhắn…`, `Gửi`, `Dừng`, `Thử lại`, `Cuộc trò chuyện mới`, `Sao chép`; technical copy duy nhất **`Chưa kết nối`**, một notice trên composer, không là message.
- C01 chưa có history list, upload/voice/share/model picker/Projects/Library/Plugins. Chỉ render controls có behavior thật.
- Composer ở hàng flex thật, không overlay message cuối; một transcript scroller, sidebar scroller riêng. Keyboard/IME/Stop/Retry/New chat giữ semantics C01.
- Reduced motion tắt transitions không cần thiết; bình thường khoảng **120–160ms**. Body/muted contrast tối thiểu **4.5:1**, focus visible, mobile drawer trap/restore focus.
- Đọc Next guides trong `node_modules/next/dist/docs/` theo AGENTS trước khi viết implementation code; đối chiếu SDK types/styles của exact pins trước khi đổi slots.
- Không execute plan, cài deps hoặc mark PASS trong bước viết docs. Existing thay đổi code/lockfile của user nằm ngoài docs commit.

## Quan hệ với C01: không làm trùng task

1. **C01 Tasks 1–3** cung cấp config/readiness/runtime/model/controller/SDK bridge. Các interfaces dưới đây là prerequisites từ C01 plan; đọc implementation user đang làm và kiểm tra signatures trước khi tích hợp, không coi file map là bằng chứng code đã hoàn tất. Không overwrite hoặc stage các thay đổi đang có của user khi thực hiện UI task.
2. **UI Tasks 1–4 bên dưới thay phần chi tiết C01 Task 4.** Không thực thi hai implementation khác nhau. File paths/callbacks C01 là boundary giữ nguyên; các UI files mới là decomposition bổ sung.
3. **UI Task 5 mở rộng browser checks của C01 Task 5.** Dùng cùng fixture provider và Playwright harness; không tạo app/agent/fixture fallback thứ hai.
4. Có thể xây shell/sidebar trước để review layout. Chat integration chỉ được gọi hoàn tất khi C01 Tasks 1–3 đã chạy và actual SDK browser checks pass. Test doubles chỉ trong tests, không mount mock agent vào product.

## SDK evidence dùng để thiết kế plan

Published 1.77.0 types/source đã đọc: `CopilotChat` có `chatView`; `CopilotChatView` có render-prop `children`, `messageView`, `input`, `welcomeScreen`, `autoScroll`; namespace `ScrollView` có `autoScroll`, `inputContainerHeight`, `scrollToBottomButton`. Default view đặt input bằng **absolute overlay**; render-prop branch cho phép app thay layout.

`CopilotChatMessageView` có `assistantMessage`/`userMessage` slots; assistant/user components có `toolbar`; assistant `MarkdownRenderer` nhận content. SDK stylesheet scope `[data-copilotkit]` dùng `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--ring` và có `.dark` overrides. Own stylesheet import sau SDK, selector đủ specificity, kiểm chứng computed styles trong browser.

Tham khảo [prebuilt components](https://docs.copilotkit.ai/prebuilt-components). Exact SDK types là authority lúc implementation; không dùng v1 `@copilotkit/react-ui`, không guess prop name từ screenshots.

## File map

| Unit | Files | Trách nhiệm |
|---|---|---|
| Theme/layout | `src/ui/chat/chat-theme.css`, `shell.tsx`, `conversation-layout.tsx` | Tokens, full viewport shell, transcript/composer rows |
| Navigation | `sidebar-shell.tsx`, `header.tsx`, `use-desktop-viewport.ts` | Desktop collapse/mobile native dialog, focus, real New chat |
| SDK projection | `chat-panel.tsx`, `white-chat-view.tsx`, `controller-context.tsx`, `message-views.tsx` | Stable slot components, SDK renderers, one controller |
| Input/notice | `composer.tsx`, `connection-notice.tsx`, `copy-action.tsx`, `workspace.tsx`, `error-boundary.tsx`, `use-controller.ts` | Draft/actions, notice, readiness/fallback integration |
| Entry | `src/app/{page.tsx,layout.tsx,globals.css}` | Entry, CSS import order, metadata/lang |
| Verification | `tests/chat/*.test.tsx`, `tests/e2e/chat-{no-env,live,failures,production}.spec.ts` | Interaction tests và actual SDK/white/mobile coverage |

Các paths C01 đã có sau Tasks 1–3 hoặc user đang triển khai: **modify**, không overwrite. UI files chưa có: **create**. Plan không sửa server/core/business contracts.

## Task 1: White tokens và shell không có overlay

**Files:** create `src/ui/chat/chat-theme.css`, `src/ui/chat/shell.tsx`, `src/ui/chat/conversation-layout.tsx`; modify `src/app/layout.tsx`, `src/app/globals.css`, `vitest.config.ts`; test `tests/chat/layout.test.tsx`.

**Interfaces:**

```ts
import type { ReactNode, ReactElement } from "react";
export type ChatShellProps = { sidebar: ReactNode; header: ReactNode; children: ReactNode };
export function ChatShell(props: ChatShellProps): ReactElement;
export type ConversationLayoutProps = { transcript: ReactNode; composer: ReactNode };
export function ConversationLayout(props: ConversationLayoutProps): ReactElement;
```

Shell main chứa header và children; conversation layout chiếm phần cao còn lại. `transcript` slot nhận **SDK ScrollView**, layout không tạo overflow scroller thứ hai. Composer slot gồm notice/input/footer actions.

- [ ] **Step 1: Viết layout behavior test.** Dùng file directive `// @vitest-environment jsdom`; mở Vitest include `tests/**/*.test.{ts,tsx}`, không đổi default node environment.

```tsx
render(<ChatShell sidebar={<nav aria-label="Điều hướng">Menu</nav>} header={<h1>Hackathon Starter Kit</h1>}>
  <ConversationLayout transcript={<p>Câu trả lời</p>} composer={<textarea aria-label="Tin nhắn" />} />
</ChatShell>);
expect(screen.getByRole("main").contains(screen.getByRole("textbox"))).toBe(true);
expect(screen.getByRole("navigation", { name: "Điều hướng" }).contains(screen.getByRole("textbox"))).toBe(false);
expect(screen.getByRole("heading", { name: "Hackathon Starter Kit" })).toBeVisible();
```

Imports test: React JSX, `render/screen` từ Testing Library, `expect/test` từ Vitest và `@testing-library/jest-dom/vitest`; production imports đúng files trên. Computed geometry/theme thuộc Task 5 browser tests, không assert stylesheet strings bằng unit test.

- [ ] **Step 2: Run RED.** `bun run test -- tests/chat/layout.test.tsx`; fail vì missing UI exports, không accept zero tests found.
- [ ] **Step 3: Implement shell và stylesheet.** Root `data-chat-theme="light"`; slot roots stable để readiness change không đổi layout.

```css
[data-chat-theme="light"] {
  color-scheme: light;
  --chat-canvas: #ffffff; --chat-sidebar: #f9f9f9; --chat-surface: #f4f4f4;
  --chat-user-bubble: #f1f1f1; --chat-hover: #ececec; --chat-text: #171717;
  --chat-muted: #666666; --chat-border: #e5e5e5; --chat-focus: #2563eb;
  --chat-send: #171717; --chat-on-send: #ffffff;
  color: var(--chat-text); background: var(--chat-canvas);
  font-family: system-ui, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.65;
}
[data-chat-theme="light"] [data-copilotkit] {
  color-scheme: light;
  --background: var(--chat-canvas); --foreground: var(--chat-text);
  --card: var(--chat-canvas); --card-foreground: var(--chat-text);
  --popover: var(--chat-canvas); --popover-foreground: var(--chat-text);
  --primary: var(--chat-send); --primary-foreground: var(--chat-on-send);
  --secondary: var(--chat-surface); --secondary-foreground: var(--chat-text);
  --muted: var(--chat-surface); --muted-foreground: var(--chat-muted);
  --accent: var(--chat-hover); --accent-foreground: var(--chat-text);
  --border: var(--chat-border); --input: var(--chat-border); --ring: var(--chat-focus);
}
.chat-shell { display: flex; height: 100dvh; overflow: hidden; }
.chat-main { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
.chat-conversation { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.chat-transcript { flex: 1; min-height: 0; min-width: 0; position: relative; }
.chat-column { width: 100%; max-width: 768px; margin-inline: auto; padding-inline: 24px; }
.chat-composer-row { flex: none; padding-bottom: 24px; }
@media (max-width: 1023px) {
  .chat-column { padding-inline: 16px; }
  .chat-composer-row { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
}
```

Implement JSX wrappers using these classes, main landmark only once. Import order in layout: SDK v2 styles → existing globals → chat-theme.css; `lang="vi"`, title starter. Existing global `h1`/`.page-shell` landing rules không được áp typography lớn vào header; scope landing styles hoặc reset header trong chat-theme. Giữ `/playground` và fixture pages đọc được, không xóa unrelated CSS.

- [ ] **Step 4: GREEN.** `bun run test -- tests/chat/layout.test.tsx` và `bun run check`; browser geometry được kiểm tra ở Task 5.
- [ ] **Step 5: Commit exact Task 1 files.** `git commit -m "feat: add white chat theme and viewport layout"` sau stage đúng files.

## Task 2: Sidebar/header và mobile dialog

**Files:** create `src/ui/chat/{sidebar-shell,header}.tsx`, `src/ui/chat/use-desktop-viewport.ts`; modify `src/ui/chat/chat-theme.css`; test `tests/chat/navigation.test.tsx`. Integrate caller trong `workspace.tsx` khi Task 4 hoàn tất.

**Interfaces:** giữ boundary C01:

```ts
export function useDesktopViewport(): boolean;
export type SidebarShellProps = { open: boolean; onClose: () => void;
  onNewChat: () => void; pending: boolean };
export function SidebarShell(props: SidebarShellProps): ReactElement;
export function ChatHeader(props: { showSidebarToggle: boolean;
  onOpenSidebar: () => void }): ReactElement;
```

`ReactElement` import từ React. `useDesktopViewport` dùng `matchMedia("(min-width: 1024px)")` qua useSyncExternalStore, server snapshot false. Workspace giữ `desktopCollapsed=false`, `mobileOpen=false`; `open = desktop ? !desktopCollapsed : mobileOpen`. Không đọc window trong SSR/render module scope. Labels: mobile/desktop mở `Mở điều hướng`, close `Đóng điều hướng`, desktop collapse `Thu gọn điều hướng`; không gọi toggle là New chat.

- [ ] **Step 1: Viết navigation tests.** Stub matchMedia typed chỉ trong tests, desktop match true cho example này. Mobile dialog focus behavior dùng browser test Task 5 vì jsdom không mô phỏng native modal đầy đủ.

```tsx
const onNewChat = vi.fn();
render(<SidebarShell open={true} onClose={vi.fn()} onNewChat={onNewChat} pending={true} />);
fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
expect(onNewChat).toHaveBeenCalledTimes(1);
expect(screen.queryByText("Projects")).not.toBeInTheDocument();
expect(screen.queryByText("Library")).not.toBeInTheDocument();
```

Imports `render/screen/fireEvent` từ existing Testing Library, `vi/expect/test` từ Vitest và jest-dom/vitest; không thêm user-event package. Kiểm tra desktop nav có label, mobile modal không đồng thời render một nav duplicate, no fake history. `pending=true` không disable New chat chỉ vì model đang running.

- [ ] **Step 2: Run RED.** `bun run test -- tests/chat/navigation.test.tsx`.
- [ ] **Step 3: Implement nav với native dialog.** Desktop dùng aside/nav 280px; mobile dùng `<dialog aria-label="Điều hướng hội thoại">`, showModal/close trong effect khi open/breakpoint đổi. Một instance sidebar content cho breakpoint hiện tại; desktop hidden không để tabbable controls. Native cancel/backdrop gọi onClose; đóng desktop transition không làm mất focus tới hidden child.

```tsx
<button type="button" aria-label="Cuộc trò chuyện mới" onClick={() => {
  onNewChat();
  if (!desktop) onClose();
}}>Cuộc trò chuyện mới</button>
```

`desktop = useDesktopViewport()` trong SidebarShell; props được destructure ở component. Mobile trigger giữ ref ở workspace/header; sau dialog close trả focus trigger nếu còn mounted. Đóng drawer khi sang desktop; từ desktop xuống mobile mặc định closed. Escape là UI close, không gửi message. Toggle/open/close buttons SVG outline + labels, 44px targets; header 56/52px, no dropdown không có behavior.

- [ ] **Step 4: GREEN + types.** Test command trên + `bun run check`; drawer browser behavior thuộc Task 5.
- [ ] **Step 5: Commit.** `git commit -m "feat: add responsive chat navigation and drawer"`.

## Task 3: SDK chatView, transcript và message actions

**Files:** create `src/ui/chat/{controller-context,message-views,copy-action}.tsx`, `src/ui/chat/use-controller.ts` nếu chưa có từ C01; modify theme CSS; test `tests/chat/transcript.test.tsx`, `tests/chat/copy-action.test.tsx`. WhiteChatView/ChatPanel được integrate ở Task 4 sau khi ChatComposer có implementation.

**Consumes C01:** `ChatController`, `ChatSnapshot`, `ChatTextMessage`, `createCopilotChatClient` và binding. Giữ signatures C01: `setDraft(value:string):void`, `send():Promise<boolean>`, `stop():Promise<void>`, `retry():Promise<boolean>`, `newChat():Promise<void>`, `fail():void`, `getSnapshot/subscribe`. Không tạo status/message IDs tại UI.

**Produces:**

```ts
import type { ComponentProps, ReactNode, ReactElement } from "react";
import { CopilotChatAssistantMessage, CopilotChatUserMessage } from "@copilotkit/react-core/v2";
export function ChatControllerProvider(props: { controller: ChatController; children: ReactNode; notice?: ReactNode }): ReactElement;
export function useChatControllerRef(): ChatController;
export function useChatNotice(): ReactNode;
export function useChatController(controller: ChatController): ChatSnapshot;
export function WhiteAssistantMessage(props: ComponentProps<typeof CopilotChatAssistantMessage>): ReactElement;
export function WhiteUserMessage(props: ComponentProps<typeof CopilotChatUserMessage>): ReactElement;
export function CopyAction(props: { content: string; onFailure: () => void }): ReactElement;
```

Controller types import `./controller` (C01 Task 3). Context giữ controller reference và notice ReactNode do workspace tính, không sở hữu một transcript/notice state thứ hai; `useChatControllerRef` throw app-owned boundary error nếu thiếu provider, error boundary mask. useSyncExternalStore đọc immutable controller snapshots; không copy messages vào local useState. `useChatNotice` lấy node hiện tại, không tự retry/fetch.

- [ ] **Step 1: Viết transcript/action tests.** Controlled controller từ `tests/helpers/chat-client.ts` của C01. SDK UI mock chỉ isolated unit; browser actual SDK ở Task 5.

```tsx
const onFailure = vi.fn();
const writeText = vi.fn().mockRejectedValue(new Error("RAW_SECRET_ERROR"));
vi.stubGlobal("navigator", { clipboard: { writeText } });
render(<CopyAction content="Câu trả lời" onFailure={onFailure} />);
fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
await waitFor(() => expect(onFailure).toHaveBeenCalledTimes(1));
expect(screen.queryByText("RAW_SECRET_ERROR")).not.toBeInTheDocument();
```

Test literal user text không render HTML executable; SDK Markdown/code còn đọc được; Copy truyền content thật, feedback không thêm message. Hide edit/regenerate/Inspector/thumbs/voice controls; streaming update không remount input hoặc nhân đôi messages.

- [ ] **Step 2: RED.** `bun run test -- tests/chat/transcript.test.tsx tests/chat/copy-action.test.tsx`.
- [ ] **Step 3: Implement stable message projection/context/Copy.** Module-level message components giữ identity qua streaming renders. Reuse SDK Markdown/user renderer, own toolbar chỉ Copy; không giữ message state riêng.

```tsx
const controller = useChatControllerRef();
return <article className="chat-assistant-message">
  <CopilotChatAssistantMessage {...props} toolbarVisible={false} />
  <CopyAction content={props.message.content ?? ""} onFailure={controller.fail} />
</article>;
```

Snippet là body của WhiteAssistantMessage, `props` đúng ComponentProps signature trên. WhiteUserMessage dùng SDK UserMessage trong own `.chat-user-message` wrapper; pass `toolbar={EmptyToolbar}` với module-level `function EmptyToolbar(): null { return null; }`, rồi render CopyAction riêng. Không tạo component factory mới mỗi token, tránh remount/copy focus loss.

Content white/gray, user căn phải; no avatar/bubble lớn cho assistant. CopyAction catch clipboard failures gọi controller.fail, không log raw error; successful copy feedback bằng aria-live text `Đã sao chép`, không đổi notice/history. Không xử lý clipboard trong model/tool layer. Own message classes style code/table, không disable Markdown security để đạt visual.

Create CSS user/assistant wrappers theo constraints: message gap 24px, user bubble width/padding/radius, long tokens overflow-wrap anywhere; assistant text không rounded bubble. Toolbar hit targets 44px, visible keyboard focus; copy feedback không nới conversation width.

- [ ] **Step 4: GREEN.** Commands RED trên + `bun run check`; Task 3 không import ChatComposer/WhiteChatView của Task 4, nên kiểm chứng độc lập được.
- [ ] **Step 5: Commit self-contained files.** `git commit -m "feat: customize chat message presentation and copy actions"`.

## Task 4: Composer, notice và workspace readiness

**Files:** create `src/ui/chat/{composer,white-chat-view}.tsx`; modify/create `src/ui/chat/{connection-notice,workspace,error-boundary,chat-panel}.tsx`, theme CSS; modify `src/app/page.tsx`; test `tests/chat/composer.test.tsx`, `tests/chat/workspace.test.tsx`.

**Interfaces:**

```ts
export function ChatComposer(props: { controller: ChatController; notice?: ReactNode }): ReactElement;
export function ConnectionNotice(props: { visible: boolean; onRetry: () => void }): ReactElement | null;
export function ChatWorkspace(): ReactElement;
export function ChatErrorBoundary(props: { children: ReactNode; onRetry: () => void }): ReactElement;
export function WhiteChatView(props: ComponentProps<typeof CopilotChatView>): ReactElement;
export function ChatPanel(props: { controller: ChatController }): ReactElement;
```

React types imports gồm ComponentProps; CopilotChatView import từ SDK v2; controller C01. ConnectionNotice chỉ presentation; workspace chọn Retry readiness khi unavailable, controller.retry khi có failed attempt. Composer không fetch model hoặc tự append user message; `notice` node từ workspace/context và render trên input. No-env fallback render cùng component; một notice owner. Interrupted có action `Thử lại` riêng nếu không có notice, gọi controller.retry; failed dùng action ở notice, không thêm Retry button trùng.

- [ ] **Step 1: Viết composer/workspace behavior tests.** Tests actual controlled C01 controller, fake SDK discovery chỉ trong unit. No-env không mount failing provider nhưng draft vẫn nhập được.

```tsx
render(<ChatComposer controller={controller} />);
fireEvent.change(screen.getByRole("textbox", { name: "Tin nhắn" }), { target: { value: "Xin chào" } });
fireEvent.compositionStart(screen.getByRole("textbox", { name: "Tin nhắn" }));
fireEvent.keyDown(screen.getByRole("textbox", { name: "Tin nhắn" }), { key: "Enter", isComposing: true });
expect(port.requests).toHaveLength(0);
fireEvent.compositionEnd(screen.getByRole("textbox", { name: "Tin nhắn" }));
fireEvent.keyDown(screen.getByRole("textbox", { name: "Tin nhắn" }), { key: "Enter" });
expect(port.requests).toHaveLength(1);
```

`port = createControlledChatPort()` và `controller = createChatController({port:port.port,uuid:()=>crypto.randomUUID(),available:true})` đầu test; imports C01 helper/controller. Thêm Shift+Enter giữ newline, >8000 input/blank không dispatch, pending Send lock/Stop, repeated provider+chat errors vẫn một status notice, readiness Retry không gọi run, New chat abort/wait/reset theo controller.

- [ ] **Step 2: RED.** `bun run test -- tests/chat/composer.test.tsx tests/chat/workspace.test.tsx`.
- [ ] **Step 3: Implement composer bằng native textarea/buttons.** Controlled value từ snapshot, autosize sau input/layout effect (set height auto, clamp scrollHeight 48..200), stable element key. maxLength/input validation 8000 từ CHAT_LIMITS; không clear draft thủ công sau submit. IME ref từ composition start/end cộng nativeEvent.isComposing; disabled Send khi !available/pending/blank. While running render Stop, khi stop teardown disable repeated Stop; New chat vẫn có thể abort run.

```tsx
<textarea aria-label="Tin nhắn" placeholder="Nhập tin nhắn…" value={snapshot.draft}
  maxLength={CHAT_LIMITS.inputChars}
  onChange={event => controller.setDraft(event.target.value)}
  onCompositionStart={() => { composing.current = true; }}
  onCompositionEnd={() => { composing.current = false; }}
  onKeyDown={event => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || composing.current) return;
    event.preventDefault();
    void controller.send();
  }} />
```

`snapshot = useChatController(controller)`, `composing = useRef(false)` trong ChatComposer. Buttons gọi controller.send/stop, không SDK submit callback thứ hai. Composer radius/padding/colors theo global constraints; outline icons 44px hit areas, loading không thay height liên tục.

- [ ] **Step 4: Implement stable chatView.** ChatPanel dùng `<CopilotChat chatView={WhiteChatView}>` dưới Task 3 controller context và SDK provider; giữ SDK bridge setup C01. WhiteChatView override callbacks/snapshot sau spread, không rely top-level CopilotChat submit vì SDK chọn internal handler. Render-prop branch thay absolute overlay bằng ConversationLayout; welcome tự render, không vào transcript.

```tsx
const controller = useChatControllerRef();
const snapshot = useChatController(controller);
const notice = useChatNotice();
return <CopilotChatView {...props} welcomeScreen={false}
  messages={snapshot.messages} isRunning={snapshot.pending}
  inputValue={snapshot.draft} onInputChange={controller.setDraft}
  onSubmitMessage={() => { void controller.send(); }} onStop={() => { void controller.stop(); }}
  messageView={{ assistantMessage: WhiteAssistantMessage, userMessage: WhiteUserMessage }}>
  {({ messageView }) => <ConversationLayout
    transcript={<CopilotChatView.ScrollView autoScroll="pin-to-bottom" inputContainerHeight={0}
      scrollToBottomButton={{ "aria-label": "Về cuối cuộc trò chuyện" }}>
      <div className="chat-column">
        {snapshot.messages.length === 0 ? <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2> : messageView}
      </div>
    </CopilotChatView.ScrollView>}
    composer={<ChatComposer controller={controller} notice={notice} />} />}
</CopilotChatView>;
```

Snippet là body của WhiteChatView với `props` theo signature trên. Imports ConversationLayout Task 1; message/context/hooks Task 3; ChatComposer Task 4. ScrollView là transcript scroller duy nhất, không render thêm BoundScrollView cùng nó. `pin-to-bottom` phải qua browser detach-scroll acceptance; nếu SDK không đáp ứng, đổi scroll slot có cùng acceptance, không weaken test.

- [ ] **Step 5: Integrate notice/controller và page.** Workspace tạo **một** controller bằng binding port C01, readiness-gated provider; no-env dùng cùng shell/composer/white tokens. WhiteChatView truyền notice node từ context xuống composer. Workspace chọn action, ConnectionNotice không tự dispatch hai loại Retry. Notice dùng `<section><p role="status" aria-live="polite">Chưa kết nối</p><button>Thử lại</button></section>`; action nằm ngoài status live region để status copy đúng và không đọc lặp controls. Không có raw errors/toasts/default error bubble.

```tsx
<ChatShell sidebar={sidebar} header={header}>
  <ChatControllerProvider controller={controller} notice={notice}>
    {readiness.available ? connectedChat : <ConversationLayout
      transcript={<div className="chat-column"><h2> Bạn muốn hỏi gì? </h2></div>}
      composer={<ChatComposer controller={controller} notice={notice} />} />}
  </ChatControllerProvider>
</ChatShell>
```

`sidebar`, `header`, `notice`, `connectedChat` là ReactNode locals tạo trong ChatWorkspace: sidebar/header Task 2; notice ConnectionNotice theo snapshot. Connected provider wiring (imports từ SDK v2):

```tsx
const connectedChat = <CopilotKit runtimeUrl="/api/copilotkit" agent="default" useSingleEndpoint={false}
  enableInspector={false} debug={false} onError={() => controller.fail()}>
  <ChatPanel controller={controller} />
</CopilotKit>;
```

Actual useAgent/useCopilotKit hooks và bridge attachment nằm dưới provider; SDK discovery ready mới attach port/setAvailable, không đọc agent từ browser env. Readiness fetch có AbortController/stale-request fence; controller UUID khởi tạo client-safe, không hydrate mismatch. No-env transcript dùng noninteractive scroller wrapper; không gọi SDK hooks ngoài provider. ErrorBoundary fallback đi qua cùng shell/notice owner, không render hai copies của notice. Workspace caller New chat giữ UI action fence trong lúc await controller.newChat; chạy model vẫn cho New chat, chỉ chặn reset lặp. Unmount abort/readiness cleanup theo C01.

- [ ] **Step 6: GREEN + check.** Unit commands trên, transcript/copy tests Task 3 và `bun run check`; chưa claim browser keyboard/mobile geometry đã pass.
- [ ] **Step 7: Commit Task 4/integration.** `git commit -m "feat: integrate white chat composer and connection states"`.

## Task 5: Actual SDK visual/interaction acceptance và handoff

**Files:** modify C01 `tests/e2e/chat-no-env.spec.ts`, `chat-live.spec.ts`, `chat-failures.spec.ts`, `chat-production.spec.ts`, `playwright.config.ts` chỉ khi harness cần; modify `docs/README.md`, `docs/code-structure.md`, UI spec status sau evidence. Reuse C01 controlled provider/harness, không thêm production preview route.

**Consumes:** no-env app 3100, configured app 3101 + test-only provider 4310, production built app 3102 từ C01 Task 5. Provider wire fixture kiểm chứng real CopilotKit, không gọi là live external model.

- [ ] **Step 1: Thêm browser assertions trước acceptance fixes.** Dùng same-origin selectors do app sở hữu: `data-chat-theme`, `.chat-shell`, `.chat-column`, `.chat-composer-row`, `.chat-user-message`, `.chat-assistant-message`, textarea label và landmarks. Viewports 390×844, 768×1024, 1440×900, 1920×1080; dark media với actual SDK view.

```ts
await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("/");
await expect(page.locator('[data-chat-theme="light"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
await expect(page.getByRole("textbox", { name: "Tin nhắn" })).toBeVisible();
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
await page.getByRole("button", { name: "Mở điều hướng" }).click();
await expect(page.getByRole("dialog", { name: "Điều hướng hội thoại" })).toBeVisible();
await page.keyboard.press("Escape");
await expect(page.getByRole("button", { name: "Mở điều hướng" })).toBeFocused();
```

Đặt accessible toggle label **`Mở điều hướng`**, close **`Đóng điều hướng`** và desktop collapse **`Thu gọn điều hướng`** ở Task 2; không regex tùy tiện chọn nhầm New chat. Assert textarea/Send/Stop contrast và computed theme surfaces sau gửi message, bao gồm code block; snapshot chưa mount SDK không đủ chứng minh CSS overrides.

- [ ] **Step 2: Run RED browser suite.** Build và harness theo C01: `bun run build`, rồi `bun run playwright test --project=chat-no-env --project=chat-live --project=chat-production`. Failure đúng missing UI behaviors, không accept no tests.
- [ ] **Step 3: Sửa acceptance failures trong UI boundaries.** Check drawer Tab/Shift+Tab trap và restore, collapse cột main vẫn center, notice single, last message trước composer top, long text/code local scroll, clipboard/IME/Enter/Shift+Enter, streaming scroll detach không giật/focus không nhảy. Add screenshots khi failure để reviewer thấy geometry; test pass không cần ghi screenshots fixture vào product.

```ts
const input = page.getByRole("textbox", { name: "Tin nhắn" });
await input.fill("Xin chào");
await input.press("Shift+Enter");
await expect(input).toHaveValue("Xin chào\n");
await expect(page.locator(".chat-user-message")).toHaveCount(0);
await input.press("Enter");
await expect(page.locator(".chat-user-message")).toHaveCount(1);
```

Kiểm tra keyboard-on-mobile không bằng desktop viewport một mình: Playwright mobile emulation + visualViewport resize test khi supported, và manual thiết bị/browser với software keyboard nếu chưa có harness. Ghi phần chưa kiểm chứng. 200% zoom dùng browser zoom/reflow check; không trình bày deviceScaleFactor như zoom. Không thêm test-only zoom query vào app.

- [ ] **Step 4: Run release checks một lần sau sửa.**

```powershell
bun run check
bun run test
bun run domain:validate
bun run build
bun run playwright test --project=chat-no-env --project=chat-live --project=chat-production
bun run e2e --project=baseline
git diff --check
```

Verify no-env/failure/error-boundary paths và production đều white/single notice, fixture production gate không đổi. Kiểm tra `/playground` để global typography/theme không gây regression. Không cần model key để chạy suite controlled provider; real own endpoint smoke optional theo C01.

- [ ] **Step 5: Handoff docs/commit.** Ghi checks thực chạy, viewport screenshots nếu cần review, manual keyboard/zoom limitation, và C02 extension seam. Chỉ mark UI done sau acceptance; `git commit -m "test: verify white chat layout and accessible interactions"`. User tự code; plan-writing không commit implementation hoặc tự gọi subagents.

## Coverage và trạng thái

| Requirement | Task |
|---|---|
| White neutral tokens, font/shapes, SDK dark override | 1, 3–5 |
| Sidebar/header/breakpoints/mobile focus/collapse | 1–2, 5 |
| Assistant/user Markdown/code/Copy/scroll | 3, 5 |
| Composer rows/keyboard/IME/limits/states | 1, 4–5 |
| One notice/no fake history/no raw errors | 2, 4–5 |
| C01 integration và C02 seam | 3–5 |

Plan self-review: spec coverage, callbacks/types và task dependencies. Các checkbox còn unchecked. Chưa viết product code, chưa chạy UI acceptance; user tự triển khai. Không hỏi lại execution method hoặc chuyển sang coding từ việc user duyệt plan này.
