"use client";

import { createContext, useContext, useEffect, type ReactElement } from "react";
import { CopilotChat, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
// eslint-disable-next-line no-restricted-imports -- Browser-safe C01 bridge uses CopilotKit's HTTP runtime endpoint.
import { createCopilotChatClient, type ChatClientBinding } from "@/adapters/agents/chat-client";
import type { ChatController } from "./controller";
import { WhiteChatView } from "./white-chat-view";

export const ChatBindingContext = createContext<ChatClientBinding | null>(null);

export function ChatPanel({ controller }: { controller: ChatController }): ReactElement {
  const binding = useContext(ChatBindingContext);
  const { agent, isReady } = useAgent({ agentId: "default" });
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    if (!binding || !isReady) return;
    const detach = binding.attach(createCopilotChatClient({ agent, copilotkit }));
    controller.setAvailable(true);
    return () => { controller.setAvailable(false); detach(); };
  }, [agent, binding, controller, copilotkit, isReady]);
  return <CopilotChat agentId="default" chatView={WhiteChatView} inspectorTools={false}
    onError={() => controller.fail()} />;
}
