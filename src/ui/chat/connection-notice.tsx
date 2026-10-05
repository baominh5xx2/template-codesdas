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
