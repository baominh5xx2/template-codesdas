import type { ReactElement } from "react";
import { CHAT_NOTICE } from "@/contracts/chat";

export type ConnectionNoticeProps = {
  visible: boolean;
  onRetry: () => void;
};

export function ConnectionNotice({
  visible,
  onRetry,
}: ConnectionNoticeProps): ReactElement | null {
  if (!visible) return null;

  return (
    <section className="chat-notice-banner" aria-label="Thông báo kết nối">
      <span className="chat-notice-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </span>
      <p className="chat-notice-status" role="status" aria-live="polite">
        {CHAT_NOTICE}
      </p>
      <button
        type="button"
        aria-label="Thử lại"
        className="chat-notice-retry-btn"
        onClick={onRetry}
      >
        Thử lại
      </button>
    </section>
  );
}
