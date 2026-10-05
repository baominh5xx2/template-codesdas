import type { ReactElement } from "react";
import { CHAT_NOTICE } from "@/contracts/chat";

export function ConnectionNotice({ visible, onRetry }: { visible: boolean; onRetry: () => void }): ReactElement | null {
  if (!visible) return null;
  return <section className="chat-connection-notice">
    <p role="status" aria-live="polite">{CHAT_NOTICE}</p>
    <button type="button" className="chat-retry-button" onClick={onRetry}>Thử lại</button>
  </section>;
}
