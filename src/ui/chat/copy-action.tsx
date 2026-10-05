"use client";

import { useState, type ReactElement } from "react";

export function CopyAction({ content, onFailure }: {
  content: string;
  onFailure: () => void;
}): ReactElement {
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  async function copy(): Promise<void> {
    setCopiedContent(null);
    try {
      await navigator.clipboard.writeText(content);
      setCopiedContent(content);
    } catch {
      onFailure();
    }
  }

  return <div className="chat-copy-action">
    <button type="button" className="chat-copy-button" aria-label="Sao chép" onClick={copy}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </svg>
    </button>
    <span className="chat-copy-feedback" role="status" aria-live="polite">
      {copiedContent === content ? "Đã sao chép" : ""}
    </span>
  </div>;
}
