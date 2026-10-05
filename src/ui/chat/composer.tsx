import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { CHAT_LIMITS } from "@/contracts/chat";
import type { ChatController } from "./controller";
import { useChatController } from "./use-controller";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type ChatComposerProps = {
  controller: ChatController;
  notice?: ReactNode;
};

export function ChatComposer({
  controller,
  notice,
}: ChatComposerProps): ReactElement {
  const snapshot = useChatController(controller);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 48), 200);
    textarea.style.height = `${nextHeight}px`;
  }, [snapshot.draft]);

  const canSend =
    snapshot.available &&
    !snapshot.pending &&
    snapshot.draft.trim().length > 0;

  const showInterruptedRetry = snapshot.status === "interrupted" && !notice;

  return (
    <div className="chat-composer-wrapper">
      {notice}
      <div className="chat-composer-card">
        <textarea
          ref={textareaRef}
          aria-label="Tin nhắn"
          placeholder="Nhập tin nhắn…"
          value={snapshot.draft}
          maxLength={CHAT_LIMITS.inputChars}
          className="chat-composer-textarea"
          rows={1}
          onChange={(event) => controller.setDraft(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key !== "Enter" ||
              event.shiftKey ||
              event.nativeEvent.isComposing ||
              composing.current
            ) {
              return;
            }
            event.preventDefault();
            if (canSend) {
              void controller.send();
            }
          }}
        />
        <div className="chat-composer-actions">
          {showInterruptedRetry && (
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
          )}
          {snapshot.pending ? (
            <button
              type="button"
              aria-label="Dừng"
              className="chat-composer-action-btn"
              onClick={() => {
                void controller.stop();
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Gửi"
              className="chat-composer-action-btn"
              disabled={!canSend}
              onClick={() => {
                void controller.send();
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
