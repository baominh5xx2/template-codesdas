"use client";

import { cloneElement, Component, isValidElement, type ReactElement, type ReactNode } from "react";
import { useChatControllerRef, useChatNotice } from "./controller-context";
import { ChatFallback } from "./white-chat-view";

class Boundary extends Component<{ children: ReactNode; fallback: (retry: () => void) => ReactNode; onError: () => void; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(): void { this.props.onError(); }
  retry = (): void => { this.setState({ failed: false }); this.props.onRetry(); };
  render(): ReactNode { return this.state.failed ? this.props.fallback(this.retry) : this.props.children; }
}

export function ChatErrorBoundary({ children, onRetry }: { children: ReactNode; onRetry: () => void }): ReactElement {
  const controller = useChatControllerRef();
  const notice = useChatNotice();
  return <Boundary onRetry={onRetry} onError={() => { controller.setAvailable(false); controller.fail(); }}
    fallback={(retry) => <ChatFallback controller={controller} notice={isValidElement<{ onRetry: () => void }>(notice)
      ? cloneElement(notice, { onRetry: retry }) : notice} />}>{children}</Boundary>;
}
