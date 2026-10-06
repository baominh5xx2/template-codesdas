import type { ReactNode, ReactElement } from "react";

export type ConversationLayoutProps = {
  transcript: ReactNode;
  composer: ReactNode;
};

export function ConversationLayout({
  transcript,
  composer,
}: ConversationLayoutProps): ReactElement {
  return (
    <div className="chat-conversation">
      <div className="chat-transcript">{transcript}</div>
      <div className="chat-composer-row">
        <div className="chat-column">{composer}</div>
      </div>
    </div>
  );
}
