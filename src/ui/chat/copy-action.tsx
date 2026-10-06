import { useState, type ReactElement } from "react";
import { CopilotChatAssistantMessage } from "@copilotkit/react-core/v2";

/**
 * Message copy using CopilotKit's own `CopyButton` (icon, tooltip, copied check state).
 * The app supplies the click handler so a clipboard failure goes through the single
 * `Chưa kết nối` notice policy instead of failing silently.
 */
export function CopyAction(props: {
  content: string;
  onFailure: () => void;
}): ReactElement {
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  const copy = async (): Promise<boolean> => {
    setCopiedContent(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(props.content);
      setCopiedContent(props.content);
      return true;
    } catch {
      props.onFailure();
      return false;
    }
  };

  return (
    <div className="chat-copy-wrapper">
      <CopilotChatAssistantMessage.CopyButton
        className="chat-copy-btn"
        title="Sao chép"
        aria-label="Sao chép"
        onClick={copy}
      />
      <span className="chat-copy-feedback" role="status" aria-live="polite">
        {copiedContent === props.content ? "Đã sao chép" : ""}
      </span>
    </div>
  );
}
