import {
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { CopilotChatInput } from "@copilotkit/react-core/v2";
import { CHAT_LIMITS } from "@/contracts/chat";
import type { ChatController } from "./controller";
import { useChatController } from "./use-controller";

type SendButtonProps = ComponentProps<typeof CopilotChatInput.SendButton>;
type TextAreaProps = ComponentProps<typeof CopilotChatInput.TextArea>;

/** No attachments/tools menu yet, so the SDK's add button is not shown. */
function HiddenSlot(): null {
  return null;
}

/**
 * CopilotKit's TextArea with an extra IME fence: the SDK skips Enter only when the native event
 * reports `isComposing`, while some IMEs fire the key event around compositionend without it.
 */
const ComposerTextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function ComposerTextArea(
  { onKeyDown, onCompositionStart, onCompositionEnd, ...props },
  ref
) {
  const composing = useRef(false);
  return (
    <CopilotChatInput.TextArea
      ref={ref}
      {...props}
      aria-label="Tin nhắn"
      placeholder="Nhập tin nhắn…"
      maxLength={CHAT_LIMITS.inputChars}
      onCompositionStart={(event) => {
        composing.current = true;
        onCompositionStart?.(event);
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        onCompositionEnd?.(event);
      }}
      onKeyDown={(event) => {
        if (!composing.current) onKeyDown?.(event);
      }}
    />
  );
});

export type ChatComposerProps = {
  controller: ChatController;
  notice?: ReactNode;
};

/**
 * Composer built from CopilotKit's own `CopilotChatInput` (textarea, autosize, Enter handling)
 * and `CopilotChatInput.SendButton`. The controller stays the single source of truth for the
 * draft, send/stop fencing and availability; this component only adapts it to the SDK slots.
 */
export function ChatComposer({
  controller,
  notice,
}: ChatComposerProps): ReactElement {
  const snapshot = useChatController(controller);
  const stopping = useRef(false);
  const [stopPending, setStopPending] = useState(false);

  const canSend =
    snapshot.available &&
    !snapshot.pending &&
    snapshot.draft.trim().length > 0 &&
    snapshot.draft.length <= CHAT_LIMITS.inputChars;

  const showInterruptedRetry =
    snapshot.status === "interrupted" && !snapshot.notice;

  // Bound per running state so the SDK button keeps one identity while typing.
  const SendButton = useMemo(() => {
    const stop = async (): Promise<void> => {
      if (stopping.current) return;
      stopping.current = true;
      setStopPending(true);
      try {
        await controller.stop();
      } finally {
        stopping.current = false;
        setStopPending(false);
      }
    };
    function ChatSendButton(props: SendButtonProps): ReactElement {
      if (!snapshot.pending) {
        return <CopilotChatInput.SendButton {...props} className="chat-send-button" aria-label="Gửi" />;
      }
      // Stop is an explicit click only: Enter while running must not cancel the response.
      return (
        <CopilotChatInput.SendButton
          {...props}
          className="chat-send-button"
          aria-label="Dừng"
          disabled={stopPending}
          onClick={() => {
            void stop();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
          </svg>
        </CopilotChatInput.SendButton>
      );
    }
    return ChatSendButton;
  }, [controller, snapshot.pending, stopPending]);

  return (
    <div className="chat-composer-wrapper">
      {notice}
      {showInterruptedRetry && (
        <div className="chat-composer-retry">
          <span>Câu trả lời đã dừng.</span>
          <button
            type="button"
            aria-label="Thử lại"
            className="chat-notice-retry-btn"
            onClick={() => {
              void controller.retry();
            }}
          >
            Thử lại
          </button>
        </div>
      )}
      <CopilotChatInput
        className="chat-composer"
        value={snapshot.draft}
        onChange={controller.setDraft}
        // Without a submit handler the SDK disables Send and ignores Enter, which keeps the draft.
        onSubmitMessage={canSend ? () => { void controller.send(); } : undefined}
        isRunning={snapshot.pending}
        textArea={ComposerTextArea}
        sendButton={SendButton}
        addMenuButton={HiddenSlot}
        showDisclaimer={false}
        bottomAnchored
      />
    </div>
  );
}
