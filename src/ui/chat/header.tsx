import type { ReactElement } from "react";
import { useDesktopViewport } from "./use-desktop-viewport";

export type ChatHeaderProps = {
  showSidebarToggle: boolean;
  onOpenSidebar: () => void;
  sidebarOpen?: boolean;
  toggleLabel?: string;
};

export function ChatHeader({
  showSidebarToggle,
  onOpenSidebar,
  sidebarOpen,
  toggleLabel,
}: ChatHeaderProps): ReactElement {
  const desktop = useDesktopViewport();

  const defaultLabel = desktop
    ? sidebarOpen === false
      ? "Mở điều hướng"
      : "Thu gọn điều hướng"
    : "Mở điều hướng";

  const label = toggleLabel ?? defaultLabel;

  return (
    <header className="chat-header">
      {showSidebarToggle && (
        <button
          type="button"
          aria-label={label}
          className="chat-icon-button"
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
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      )}
      <h1 className="chat-header-title">AI Thực chiến × TriplePeek</h1>
    </header>
  );
}
