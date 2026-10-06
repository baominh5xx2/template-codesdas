import { useEffect, useRef, type ReactElement } from "react";
import { useDesktopViewport } from "./use-desktop-viewport";

export type SidebarShellProps = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  pending: boolean;
};

function SidebarBrand(): ReactElement {
  return (
    <span className="chat-sidebar-brand" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand mark inside the client sidebar */}
      <img src="/brand/ai-thuc-chien.png" alt="" width={40} height={40} />
      <span className="chat-sidebar-brand-text"><small>AI Thực chiến ×</small>TriplePeek</span>
    </span>
  );
}

const SIDEBAR_FOOTER = "Hội thoại chỉ được giữ trong phiên làm việc này.";

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
        <div className="chat-sidebar-header"><SidebarBrand /></div>
        {navContent}
        <p className="chat-sidebar-footer">{SIDEBAR_FOOTER}</p>
      </aside>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Điều hướng hội thoại"
      className="chat-mobile-dialog"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
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
        <SidebarBrand />
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
      <p className="chat-sidebar-footer">{SIDEBAR_FOOTER}</p>
    </dialog>
  );
}
