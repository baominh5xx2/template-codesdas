import { useEffect, useRef, type ReactElement } from "react";
import { useDesktopViewport } from "./use-desktop-viewport";

export type SidebarShellProps = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  pending: boolean;
};

export function SidebarShell({
  open,
  onClose,
  onNewChat,
}: SidebarShellProps): ReactElement | null {
  const desktop = useDesktopViewport();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (desktop) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Fallback if showModal fails in unsupported test environments
        }
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open, desktop]);

  const navContent = (
    <nav aria-label="Điều hướng" className="chat-sidebar-nav">
      <button
        type="button"
        aria-label="Cuộc trò chuyện mới"
        className="chat-new-chat-button"
        onClick={() => {
          onNewChat();
          if (!desktop) {
            onClose();
          }
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
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Cuộc trò chuyện mới</span>
      </button>
    </nav>
  );

  if (desktop) {
    if (!open) {
      return (
        <aside className="chat-sidebar" aria-label="Điều hướng" hidden>
          {/* Hidden on desktop: no focusable controls */}
        </aside>
      );
    }
    return (
      <aside className="chat-sidebar" aria-label="Điều hướng">
        {navContent}
      </aside>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Điều hướng hội thoại"
      className="chat-mobile-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="chat-sidebar-header">
        <span className="chat-header-title">Menu</span>
        <button
          type="button"
          aria-label="Đóng điều hướng"
          className="chat-icon-button"
          onClick={onClose}
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {navContent}
    </dialog>
  );
}
