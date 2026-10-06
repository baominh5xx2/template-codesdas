"use client";

/**
 * "Thinking" indicator adapted from React Bits "Thought Line" (reactbits.dev, MIT + Commons Clause):
 * a breathing sparkle, a shimmering label and a live timer. Only the working state is kept because
 * the transcript replaces it with the answer; icons are inline SVG instead of an icon package.
 */
import { useEffect, useRef, type ReactElement } from "react";
import "./thought-line.css";

const fmt = (ds: number): string =>
  ds < 600 ? `${(ds / 10).toFixed(1).replace(".", ",")} giây` : `${Math.floor(ds / 600)} phút ${((ds % 600) / 10).toFixed(0)} giây`;

export function ThoughtLine({ label = "Đang suy nghĩ…" }: { label?: string }): ReactElement {
  const timerRef = useRef<HTMLSpanElement>(null);

  // Painted outside React so the timer ticks without re-rendering the transcript.
  useEffect(() => {
    const startedAt = performance.now();
    const paint = () => {
      if (timerRef.current) timerRef.current.textContent = fmt(Math.floor((performance.now() - startedAt) / 100));
    };
    paint();
    const id = window.setInterval(paint, 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="thought-line" role="status" aria-label="Đang trả lời">
      <span className="thought-line__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1Z" />
          <path d="M19 3v3M17.5 4.5h3M5 17.5v2.5M3.75 18.75h2.5" />
        </svg>
      </span>
      <span className="thought-line__text" aria-hidden="true">{label}</span>
      <span ref={timerRef} className="thought-line__timer" aria-hidden="true">0,0 giây</span>
    </div>
  );
}
