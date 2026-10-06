"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { CopilotChatView, CopilotChatAssistantMessage, CopilotChatUserMessage } from "@copilotkit/react-core/v2";
import type { ChatController } from "./controller";
import { useChatControllerRef, useChatNotice } from "./controller-context";
import { useChatController } from "./use-controller";
import { ConversationLayout } from "./conversation-layout";
import { ChatComposer } from "./composer";
import { WhiteAssistantMessage, WhiteUserMessage } from "./message-views";

// The installed slot types require the SDK component namespaces as well as their render signature.
const AssistantMessageSlot = Object.assign(WhiteAssistantMessage, CopilotChatAssistantMessage);
const UserMessageSlot = Object.assign(WhiteUserMessage, CopilotChatUserMessage);

export function WhiteChatView(props: ComponentProps<typeof CopilotChatView>): ReactElement {
  const controller = useChatControllerRef();
  const snapshot = useChatController(controller);
  const notice = useChatNotice();
  return <CopilotChatView {...props} className="chat-view" welcomeScreen={false}
    messages={snapshot.messages} isRunning={snapshot.pending}
    inputValue={snapshot.draft} onInputChange={controller.setDraft}
    onSubmitMessage={() => { void controller.send(); }} onStop={() => { void controller.stop(); }}
    messageView={{ assistantMessage: AssistantMessageSlot, userMessage: UserMessageSlot }}>
    {({ messageView }) => <ConversationLayout
      transcript={<CopilotChatView.ScrollView data-chat-scroll autoScroll="pin-to-bottom" inputContainerHeight={0}
        scrollToBottomButton={{ "aria-label": "Về cuối cuộc trò chuyện", className: "chat-scroll-bottom-button",
          style: { minWidth: 44, minHeight: 44 } }}>
        <div className="chat-column">
          {snapshot.messages.length === 0 ? <ChatWelcome /> : messageView}
        </div>
      </CopilotChatView.ScrollView>}
      composer={<ChatComposer controller={controller} notice={notice} />} />}
  </CopilotChatView>;
}

export function ChatFallback({ controller, notice }: { controller: ChatController; notice: ReactNode }): ReactElement {
  const snapshot = useChatController(controller);
  return <ConversationLayout transcript={<div className="chat-fallback-scroll">
    <div className="chat-column">{snapshot.messages.length === 0
      ? <ChatWelcome />
      : snapshot.messages.map((message) => <article key={message.id} className={`chat-fallback-${message.role}`}>{message.content}</article>)}</div>
  </div>} composer={<ChatComposer controller={controller} notice={notice} />} />;
}

const SUGGESTIONS = [
  { title: "Phân tích đề bài", text: "Đọc đề bài sau và liệt kê yêu cầu, ràng buộc và tiêu chí chấm điểm:\n", image: "/images/desk.jpg" },
  { title: "Viết code", text: "Viết một route API Next.js đọc file CSV và trả về JSON đã kiểm tra kiểu bằng Zod.", image: "/images/code.jpg" },
  { title: "Sửa lỗi", text: "Giải thích lỗi sau và đề xuất cách sửa:\n", image: "/images/typing.jpg" },
  { title: "Lên kế hoạch", text: "Chia công việc 48 giờ cho nhóm 4 người để hoàn thành bài dự thi.", image: "/images/map-travel.jpg" },
] as const;

/** Empty state in the website's hero language: photo banner, display heading, starter cards. */
export function ChatWelcome(): ReactElement {
  const controller = useChatControllerRef();
  const start = (text: string) => {
    controller.setDraft(text);
    document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Tin nhắn"]')?.focus();
  };
  return <div className="chat-welcome-block">
    <div className="chat-welcome-hero">
      <p className="chat-welcome-kicker">AI Thực chiến × TriplePeek</p>
      <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2>
      <p className="chat-welcome-lead">Đặt câu hỏi, dán đoạn code hoặc mô tả việc cần làm. Enter để gửi, Shift + Enter để xuống dòng.</p>
    </div>
    <div className="chat-suggestions" role="group" aria-label="Gợi ý để bắt đầu">
      {SUGGESTIONS.map((item) => <button key={item.title} type="button" className="chat-suggestion" onClick={() => start(item.text)}>
        <span className="chat-suggestion-frame" aria-hidden="true"><span className="chat-suggestion-media" style={{ backgroundImage: `url(${item.image})` }} /></span>
        <span className="chat-suggestion-title">{item.title}</span>
        <span className="chat-suggestion-text">{item.text.trim()}</span>
      </button>)}
    </div>
  </div>;
}
