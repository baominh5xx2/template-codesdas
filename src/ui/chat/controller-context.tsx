import { createContext, useContext, type ReactElement, type ReactNode } from "react";
// eslint-disable-next-line no-restricted-imports
import type { ChatClientBinding } from "@/adapters/agents/chat-client";
import type { ChatController } from "./controller";

type ChatControllerContextValue = {
  controller: ChatController;
  binding?: ChatClientBinding;
  notice?: ReactNode;
};

const ChatControllerContext = createContext<ChatControllerContextValue | null>(null);

export function ChatControllerProvider(props: {
  controller: ChatController;
  binding?: ChatClientBinding;
  children: ReactNode;
  notice?: ReactNode;
}): ReactElement {
  return (
    <ChatControllerContext.Provider
      value={{
        controller: props.controller,
        binding: props.binding,
        notice: props.notice,
      }}
    >
      {props.children}
    </ChatControllerContext.Provider>
  );
}

export function useChatControllerRef(): ChatController {
  const ctx = useContext(ChatControllerContext);
  if (!ctx) {
    throw new Error("useChatControllerRef must be used within a ChatControllerProvider");
  }
  return ctx.controller;
}

export function useChatNotice(): ReactNode {
  const ctx = useContext(ChatControllerContext);
  return ctx?.notice;
}

export function useChatBinding(): ChatClientBinding | undefined {
  const ctx = useContext(ChatControllerContext);
  return ctx?.binding;
}
