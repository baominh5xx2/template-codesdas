"use client";

import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { CHAT_LIMITS } from "@/contracts/chat";
import type { ChatController } from "./controller";
import { useChatController } from "./use-controller";

export function ChatComposer({ controller, notice }: { controller: ChatController; notice?: ReactNode }): ReactElement {
  const snapshot = useChatController(controller);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const stopping = useRef(false);
  const [stopPending, setStopPending] = useState(false);
  const disabled = !snapshot.available || snapshot.pending || !snapshot.draft.trim() || snapshot.draft.length > CHAT_LIMITS.inputChars;

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(200, Math.max(48, input.scrollHeight))}px`;
  }, [snapshot.draft]);

  async function stop(): Promise<void> {
    if (stopping.current) return;
    stopping.current = true;
    setStopPending(true);
    try { await controller.stop(); }
    finally { stopping.current = false; setStopPending(false); }
  }

  return <div className="chat-column">
    {notice}
    <div className="chat-composer">
      <textarea ref={textarea} aria-label="Tin nhắn" placeholder="Nhập tin nhắn…" rows={1}
        value={snapshot.draft} maxLength={CHAT_LIMITS.inputChars}
        onChange={(event) => controller.setDraft(event.target.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || composing.current) return;
          event.preventDefault();
          void controller.send();
        }} />
      {snapshot.pending ? <button type="button" className="chat-send-button" aria-label="Dừng trả lời"
        disabled={stopPending} onClick={() => { void stop(); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
      </button> : <button type="button" className="chat-send-button" aria-label="Gửi tin nhắn"
        disabled={disabled} onClick={() => { void controller.send(); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7" /></svg>
      </button>}
    </div>
  </div>;
}
