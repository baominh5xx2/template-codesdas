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
              scrollToBottomButton={{ "aria-label": "Về cuối cuộc trò chuyện" }}
            >
              <div className="chat-column">
                {snapshot.transcript.length === 0 ? (
                  <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2>
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
