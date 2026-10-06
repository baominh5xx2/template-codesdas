"use client";

import { useState, type ReactElement } from "react";
import { CopilotChatAssistantMessage } from "@copilotkit/react-core/v2";

/**
 * Message copy using CopilotKit's own `CopyButton` (icon, tooltip, copied check state).
 * The app supplies the click handler so a clipboard failure goes through the single
 * `Chưa kết nối` notice policy instead of failing silently.
 */
export function CopyAction({ content, onFailure }: {
  content: string;
  onFailure: () => void;
}): ReactElement {
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  async function copy(): Promise<boolean> {
    setCopiedContent(null);
    try {
      await navigator.clipboard.writeText(content);
      setCopiedContent(content);
      return true;
    } catch {
      onFailure();
      return false;
    }
  }

  return <div className="chat-copy-action">
    <CopilotChatAssistantMessage.CopyButton className="chat-copy-button" title="Sao chép" aria-label="Sao chép" onClick={copy} />
    <span className="chat-copy-feedback" role="status" aria-live="polite">
      {copiedContent === content ? "Đã sao chép" : ""}
    </span>
  </div>;
}
