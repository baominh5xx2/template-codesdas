import { Component, type ReactNode } from "react";
import { CHAT_NOTICE } from "@/contracts/chat";

export type ChatErrorBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
  onFailure?: () => void;
  fallback?: (retry: () => void) => ReactNode;
};

type ChatErrorBoundaryState = {
  hasError: boolean;
};

export class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  override state: ChatErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ChatErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    // Mask error details completely to avoid leaking secrets
    this.props.onFailure?.();
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
    this.props.onRetry();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <div className="chat-error-boundary-view chat-error-boundary-layout">{this.props.fallback(this.handleRetry)}</div>;
      }
      return (
        <div className="chat-error-boundary-view">
          <section className="chat-notice-banner" aria-label="Thông báo lỗi">
            <p className="chat-notice-status" role="status" aria-live="polite">
              {CHAT_NOTICE}
            </p>
            <button
              type="button"
              aria-label="Thử lại"
              className="chat-notice-retry-btn"
              onClick={this.handleRetry}
            >
              Thử lại
            </button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
