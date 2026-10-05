import { useRef } from "react";
import type { ReactElement } from "react";

export type ChatHeaderProps = {
  showSidebarToggle: boolean;
  onOpenSidebar: () => void;
};

export function ChatHeader({
  showSidebarToggle,
  onOpenSidebar,
}: ChatHeaderProps): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <header className="chat-header">
      {showSidebarToggle && (
        <button
          ref={triggerRef}
          data-chat-sidebar-trigger
          type="button"
          className="chat-header-toggle"
          aria-label="Mở điều hướng"
          onClick={onOpenSidebar}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <h1 className="chat-header-title">Hackathon Starter Kit</h1>
    </header>
  );
}
