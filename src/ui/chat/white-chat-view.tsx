import { forwardRef, type ComponentProps, type HTMLAttributes, type ReactElement } from "react";
import {
  CopilotChatView,
  type CopilotChatSuggestionPillProps,
  type CopilotChatSuggestionView,
} from "@copilotkit/react-core/v2";
import { ConversationLayout } from "./conversation-layout";
import { ChatComposer } from "./composer";
import { useChatControllerRef, useChatNotice } from "./controller-context";
import { useChatController } from "./use-controller";
import { WhiteAssistantMessage, WhiteUserMessage } from "./message-views";
import { ToolTranscript } from "./tool-renderers";
import { ThoughtLine } from "./thought-line";

type Suggestion = ComponentProps<typeof CopilotChatSuggestionView>["suggestions"][number];
type WelcomeScreenProps = ComponentProps<typeof CopilotChatView.WelcomeScreen>;

const STARTERS = [
  { title: "Phân tích đề bài", message: "Đọc đề bài sau và liệt kê yêu cầu, ràng buộc và tiêu chí chấm điểm:\n", image: "/images/desk.jpg" },
  { title: "Viết code", message: "Viết một route API Next.js đọc file CSV và trả về JSON đã kiểm tra kiểu bằng Zod.", image: "/images/code.jpg" },
  { title: "Sửa lỗi", message: "Giải thích lỗi sau và đề xuất cách sửa:\n", image: "/images/typing.jpg" },
  { title: "Tính ngân sách", message: "Tính ngân sách bằng tool: thuê máy 2.000.000 VND, ăn uống 1.500.000 VND, in ấn 300.000 VND; ngân sách 5.000.000 VND.", image: "/images/map-travel.jpg" },
] as const;

/** Static starter prompts in the SDK's own suggestion shape. */
const SUGGESTIONS: Suggestion[] = STARTERS.map(({ title, message }) => ({ title, message, isLoading: false }));

const SCROLL_TO_BOTTOM = { "aria-label": "Về cuối cuộc trò chuyện", className: "chat-scroll-bottom-button" };

/**
 * The transcript area of the chat, built on CopilotChatView's slots:
 * - `welcomeScreen` renders the hero while the controller transcript is empty (the SDK picks this
 *   branch before the `children` render-prop, so both states go through CopilotChatView);
 * - `suggestionView` renders the starter prompts through CopilotChatSuggestionView;
 * - `children` renders the controller transcript once there is one.
 * The composer sits outside CopilotChatView so it never remounts (and never loses focus) when the
 * SDK swaps the welcome branch for the transcript branch on the first message.
 */
export function WhiteChatView(
  props: ComponentProps<typeof CopilotChatView>
): ReactElement {
  const controller = useChatControllerRef();
  const snapshot = useChatController(controller);
  const notice = useChatNotice();
  const toolRunning = snapshot.transcript.some((message) =>
    message.role === "assistant" && (message.toolCalls ?? []).some((call) => call.status === "pending" || call.status === "running"));

  // The controller owns the draft: a starter only fills and focuses the composer. CopilotChat's
  // default handler would append a message and run the agent directly, so it is replaced here.
  const selectSuggestion = (suggestion: Suggestion) => {
    controller.setDraft(suggestion.message);
    document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Tin nhắn"]')?.focus();
  };

  return (
    <ConversationLayout
      transcript={
        <CopilotChatView
          {...props}
          // The controller transcript is local; SDK thread-connect state never hides the welcome.
          isConnecting={false}
          hasExplicitThreadId={false}
          welcomeScreen={ChatWelcomeScreen}
          suggestions={SUGGESTIONS}
          onSelectSuggestion={selectSuggestion}
          suggestionView={STARTER_SUGGESTION_VIEW}
          messages={snapshot.messages}
          isRunning={snapshot.pending}
          inputValue={snapshot.draft}
          onInputChange={controller.setDraft}
          onSubmitMessage={() => {
            void controller.send();
          }}
          onStop={() => {
            void controller.stop();
          }}
          messageView={{
            assistantMessage: WhiteAssistantMessage,
            userMessage: WhiteUserMessage,
          }}
        >
          {() => (
            <CopilotChatView.ScrollView autoScroll="pin-to-bottom" inputContainerHeight={0} scrollToBottomButton={SCROLL_TO_BOTTOM}>
              <div className="chat-column">
                <div className="chat-messages-container">
                  <ToolTranscript messages={snapshot.transcript} />
                  {snapshot.pending && <ThoughtLine label={toolRunning ? "Đang dùng công cụ…" : "Đang suy nghĩ…"} />}
                </div>
              </div>
            </CopilotChatView.ScrollView>
          )}
        </CopilotChatView>
      }
      composer={<ChatComposer controller={controller} notice={notice} />}
    />
  );
}

/** `welcomeScreen` slot: the website's hero language. The SDK's `input` is ignored because the
 * app composer lives outside CopilotChatView; `suggestionView` is the bound starter grid. */
function ChatWelcomeScreen({ suggestionView }: WelcomeScreenProps): ReactElement {
  return (
    <CopilotChatView.ScrollView autoScroll="pin-to-bottom" inputContainerHeight={0} scrollToBottomButton={SCROLL_TO_BOTTOM}>
      <div className="chat-column">
        <div className="chat-welcome-block">
          <div className="chat-welcome-hero">
            <p className="chat-welcome-kicker">AI Thực chiến × TriplePeek</p>
            <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2>
            <p className="chat-welcome-lead">Đặt câu hỏi, dán đoạn code hoặc mô tả việc cần làm. Enter để gửi, Shift + Enter để xuống dòng.</p>
          </div>
          {suggestionView}
        </div>
      </div>
    </CopilotChatView.ScrollView>
  );
}

/** `container` slot of CopilotChatSuggestionView: the starter grid (drops the SDK's pill-row classes). */
const StarterGrid = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function StarterGrid(
  props,
  ref
) {
  return <div ref={ref} {...props} className="chat-suggestions" role="group" aria-label="Gợi ý để bắt đầu" />;
});

/** `suggestion` slot of CopilotChatSuggestionView: a photo card instead of the SDK pill. */
const StarterCard = forwardRef<HTMLButtonElement, CopilotChatSuggestionPillProps>(function StarterCard(
  { children, onClick, disabled },
  ref
) {
  const starter = STARTERS.find((item) => item.title === children);
  return (
    <button ref={ref} type="button" className="chat-suggestion" onClick={onClick} disabled={disabled}>
      <span className="chat-suggestion-frame" aria-hidden="true">
        {starter && <span className="chat-suggestion-media" style={{ backgroundImage: `url(${starter.image})` }} />}
      </span>
      <span className="chat-suggestion-title">{children}</span>
      {starter && <span className="chat-suggestion-text">{starter.message.trim()}</span>}
    </button>
  );
});

/** Stable object slot (CopilotKit memoizes slots by identity). */
const STARTER_SUGGESTION_VIEW = { container: StarterGrid, suggestion: StarterCard };
