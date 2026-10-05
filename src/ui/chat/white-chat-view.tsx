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
          {snapshot.messages.length === 0 ? <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2> : messageView}
        </div>
      </CopilotChatView.ScrollView>}
      composer={<ChatComposer controller={controller} notice={notice} />} />}
  </CopilotChatView>;
}

export function ChatFallback({ controller, notice }: { controller: ChatController; notice: ReactNode }): ReactElement {
  const snapshot = useChatController(controller);
  return <ConversationLayout transcript={<div className="chat-fallback-scroll">
    <div className="chat-column">{snapshot.messages.length === 0
      ? <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2>
      : snapshot.messages.map((message) => <article key={message.id} className={`chat-fallback-${message.role}`}>{message.content}</article>)}</div>
  </div>} composer={<ChatComposer controller={controller} notice={notice} />} />;
}
