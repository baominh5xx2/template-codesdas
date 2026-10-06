"use client";

import { forwardRef, useMemo, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { CopilotChatInput } from "@copilotkit/react-core/v2";
import { CHAT_LIMITS } from "@/contracts/chat";
import type { ChatController } from "./controller";
import { useChatController } from "./use-controller";

type SendButtonProps = ComponentProps<typeof CopilotChatInput.SendButton>;

/** C01 has no attachments/tools menu yet, so the SDK's add button is not shown. */
function HiddenSlot(): null { return null; }

/**
 * CopilotKit's TextArea with an extra IME fence: the SDK skips Enter only when the native event
 * reports `isComposing`, while some IMEs fire the key event around compositionend without it.
 */
const ChatTextArea = forwardRef<HTMLTextAreaElement, ComponentProps<typeof CopilotChatInput.TextArea>>(function ChatTextArea(
  { onKeyDown, onCompositionStart, onCompositionEnd, ...props }, ref) {
  const composing = useRef(false);
  return <CopilotChatInput.TextArea ref={ref} {...props}
    onCompositionStart={(event) => { composing.current = true; onCompositionStart?.(event); }}
    onCompositionEnd={(event) => { composing.current = false; onCompositionEnd?.(event); }}
    onKeyDown={(event) => { if (!composing.current) onKeyDown?.(event); }} />;
});

/** App labels and the input limit applied to the SDK textarea. */
const ComposerTextArea = forwardRef<HTMLTextAreaElement, ComponentProps<typeof CopilotChatInput.TextArea>>(function ComposerTextArea(props, ref) {
  return <ChatTextArea ref={ref} {...props} aria-label="Tin nhắn" placeholder="Nhập tin nhắn…" maxLength={CHAT_LIMITS.inputChars} />;
});

/**
 * Composer built from CopilotKit's own `CopilotChatInput` (textarea, autosize, IME/Enter handling)
 * and `CopilotChatInput.SendButton`. The app controller stays the single source of truth for the
 * draft, send/stop fencing and availability; this component only adapts it to the SDK slots.
 */
export function ChatComposer({ controller, notice }: { controller: ChatController; notice?: ReactNode }): ReactElement {
  const snapshot = useChatController(controller);
  const stopping = useRef(false);
  const [stopPending, setStopPending] = useState(false);
  const blocked = !snapshot.available || snapshot.pending || snapshot.notice || snapshot.draft.length > CHAT_LIMITS.inputChars;

  // Bound per running state so the SDK button keeps one identity while typing.
  const SendButton = useMemo(() => {
    const stop = async (): Promise<void> => {
      if (stopping.current) return;
      stopping.current = true;
      setStopPending(true);
      try { await controller.stop(); }
      finally { stopping.current = false; setStopPending(false); }
    };
    function ChatSendButton(props: SendButtonProps): ReactElement {
      if (!snapshot.pending) return <CopilotChatInput.SendButton {...props} className="chat-send-button" aria-label="Gửi tin nhắn" />;
      // Stop is an explicit click only: Enter while running must not cancel the response.
      return <CopilotChatInput.SendButton {...props} className="chat-send-button" aria-label="Dừng trả lời" disabled={stopPending}
        onClick={() => { void stop(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
      </CopilotChatInput.SendButton>;
    }
    return ChatSendButton;
  }, [controller, snapshot.pending, stopPending]);

  return <div className="chat-column">
    {notice}
    <CopilotChatInput className="chat-composer"
      value={snapshot.draft}
      onChange={controller.setDraft}
      // Without a submit handler the SDK disables Send and ignores Enter, which keeps the draft.
      onSubmitMessage={blocked ? undefined : () => { void controller.send(); }}
      isRunning={snapshot.pending}
      textArea={ComposerTextArea}
      sendButton={SendButton}
      addMenuButton={HiddenSlot}
      showDisclaimer={false}
      bottomAnchored />
  </div>;
}
