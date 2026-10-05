import { useState, type ReactElement } from "react";

export function CopyAction(props: {
  content: string;
  onFailure: () => void;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(props.content);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      props.onFailure();
    }
  };

  return (
    <div className="chat-copy-wrapper">
      <button
        type="button"
        aria-label="Sao chép"
        className="chat-copy-btn"
        onClick={() => {
          void handleCopy();
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </button>
      {copied && (
        <span className="chat-copy-feedback" role="status" aria-live="polite">
          Đã sao chép
        </span>
      )}
    </div>
  );
}
