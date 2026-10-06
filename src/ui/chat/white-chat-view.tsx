import type { ComponentProps, ReactElement } from "react";
import { CopilotChatMessageView, CopilotChatView } from "@copilotkit/react-core/v2";
import { ConversationLayout } from "./conversation-layout";
import { ChatComposer } from "./composer";
import { useChatControllerRef, useChatNotice } from "./controller-context";
import { useChatController } from "./use-controller";
import { WhiteAssistantMessage, WhiteUserMessage } from "./message-views";
import { ToolTranscript } from "./tool-renderers";

export function WhiteChatView(
  props: ComponentProps<typeof CopilotChatView>
): ReactElement {
  const controller = useChatControllerRef();
  const snapshot = useChatController(controller);
  const notice = useChatNotice();

  return (
    <CopilotChatView
      {...props}
      welcomeScreen={false}
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
        <ConversationLayout
          transcript={
            <CopilotChatView.ScrollView
              autoScroll="pin-to-bottom"
              inputContainerHeight={0}
              scrollToBottomButton={{ "aria-label": "Về cuối cuộc trò chuyện", className: "chat-scroll-bottom-button" }}
            >
              <div className="chat-column">
                {snapshot.transcript.length === 0 ? (
                  <ChatWelcome />
                ) : (
                  <div className="chat-messages-container">
                    <ToolTranscript messages={snapshot.transcript} />
                    {snapshot.pending && <CopilotChatMessageView.Cursor aria-label="Đang trả lời" />}
                  </div>
                )}
              </div>
            </CopilotChatView.ScrollView>
          }
          composer={<ChatComposer controller={controller} notice={notice} />}
        />
      )}
    </CopilotChatView>
  );
}

const SUGGESTIONS = [
  { title: "Phân tích đề bài", text: "Đọc đề bài sau và liệt kê yêu cầu, ràng buộc và tiêu chí chấm điểm:\n", image: "/images/desk.jpg" },
  { title: "Viết code", text: "Viết một route API Next.js đọc file CSV và trả về JSON đã kiểm tra kiểu bằng Zod.", image: "/images/code.jpg" },
  { title: "Sửa lỗi", text: "Giải thích lỗi sau và đề xuất cách sửa:\n", image: "/images/typing.jpg" },
  { title: "Tính ngân sách", text: "Tính ngân sách bằng tool: thuê máy 2.000.000 VND, ăn uống 1.500.000 VND, in ấn 300.000 VND; ngân sách 5.000.000 VND.", image: "/images/map-travel.jpg" },
] as const;

/** Empty state in the website's hero language: photo banner, display heading, starter cards. */
function ChatWelcome(): ReactElement {
  const controller = useChatControllerRef();
  const start = (text: string) => {
    controller.setDraft(text);
    document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Tin nhắn"]')?.focus();
  };
  return (
    <div className="chat-welcome-block">
      <div className="chat-welcome-hero">
        <p className="chat-welcome-kicker">AI Thực chiến × TriplePeek</p>
        <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2>
        <p className="chat-welcome-lead">Đặt câu hỏi, dán đoạn code hoặc mô tả việc cần làm. Enter để gửi, Shift + Enter để xuống dòng.</p>
      </div>
      <div className="chat-suggestions" role="group" aria-label="Gợi ý để bắt đầu">
        {SUGGESTIONS.map((item) => (
          <button key={item.title} type="button" className="chat-suggestion" onClick={() => start(item.text)}>
            <span className="chat-suggestion-frame" aria-hidden="true">
              <span className="chat-suggestion-media" style={{ backgroundImage: `url(${item.image})` }} />
            </span>
            <span className="chat-suggestion-title">{item.title}</span>
            <span className="chat-suggestion-text">{item.text.trim()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
