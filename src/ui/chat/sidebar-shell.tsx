import { useEffect, useRef } from "react";
import type { MouseEvent, ReactElement, SyntheticEvent } from "react";
import { useDesktopViewport } from "./use-desktop-viewport";

export type SidebarShellProps = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  pending: boolean;
};

export function SidebarShell({ open, onClose, onNewChat, pending }: SidebarShellProps): ReactElement {
  // A new chat also cancels a running response through the controller.
  void pending;
  const desktop = useDesktopViewport();
  const asideRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousDesktop = useRef(desktop);

  useEffect(() => {
    if (desktop && !open && asideRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLButtonElement>("[data-chat-sidebar-trigger]")?.focus();
    }
  }, [desktop, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (desktop || previousDesktop.current || !dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [desktop, open]);

  useEffect(() => {
    if (previousDesktop.current !== desktop) {
      previousDesktop.current = desktop;
      // An expanded desktop panel must not become an open mobile drawer.
      if (!desktop && open) onClose();
    }
  }, [desktop, open, onClose]);

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      onClose();
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  const content = (
    <>
      <div className="chat-sidebar-header">
        <button type="button" className="chat-sidebar-action-btn"
          aria-label={desktop ? "Thu gọn điều hướng" : "Đóng điều hướng"} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {desktop ? <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m14 9-3 3 3 3" /></>
              : <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>}
          </svg>
        </button>
      </div>
      <nav aria-label="Điều hướng" className="chat-sidebar-nav">
        <button type="button" className="chat-sidebar-new-chat-btn" aria-label="Cuộc trò chuyện mới"
          onClick={() => { onNewChat(); if (!desktop) onClose(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Cuộc trò chuyện mới</span>
        </button>
      </nav>
    </>
  );

  return desktop ? (
    <aside ref={asideRef} className="chat-sidebar" hidden={!open}>{content}</aside>
  ) : (
    <dialog ref={dialogRef} className="chat-mobile-dialog" aria-label="Điều hướng hội thoại"
      onClick={handleBackdrop} onCancel={handleCancel}>
      <div className="chat-sidebar-content">{content}</div>
    </dialog>
  );
}
