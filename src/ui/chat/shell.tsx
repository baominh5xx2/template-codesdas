import type { ReactNode, ReactElement } from "react";

export type ChatShellProps = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export function ChatShell({ sidebar, header, children }: ChatShellProps): ReactElement {
  return (
    <div className="chat-shell" data-chat-theme="light">
      {sidebar}
      <main className="chat-main">
        {header}
        {children}
      </main>
    </div>
  );
}
