import type { ReactElement } from "react";
import { CHAT_NOTICE } from "@/contracts/chat";

export function ConnectionNotice({ visible, onRetry }: { visible: boolean; onRetry: () => void }): ReactElement | null {
  if (!visible) return null;
  return <section className="chat-connection-notice">
    <span className="chat-connection-notice-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
    </span>
    <p role="status" aria-live="polite">{CHAT_NOTICE}</p>
    <button type="button" className="chat-retry-button" onClick={onRetry}>Thử lại</button>
  </section>;
}
