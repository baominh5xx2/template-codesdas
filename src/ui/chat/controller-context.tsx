"use client";

import { createContext, useContext, type ReactElement, type ReactNode } from "react";
import type { ChatController } from "./controller";

const ControllerContext = createContext<ChatController | null>(null);
const NoticeContext = createContext<ReactNode>(null);

export function ChatControllerProvider({ controller, children, notice = null }: {
  controller: ChatController;
  children: ReactNode;
  notice?: ReactNode;
}): ReactElement {
  return <ControllerContext.Provider value={controller}>
    <NoticeContext.Provider value={notice}>{children}</NoticeContext.Provider>
  </ControllerContext.Provider>;
}

export function useChatControllerRef(): ChatController {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error("Chat controller provider is missing");
  return controller;
}

export function useChatNotice(): ReactNode {
  return useContext(NoticeContext);
}
