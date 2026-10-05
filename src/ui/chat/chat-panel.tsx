import { useEffect, type ReactElement } from "react";
import { CopilotChat, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
// eslint-disable-next-line no-restricted-imports
import { createCopilotChatClient } from "@/adapters/agents/chat-client";
import type { ChatController } from "./controller";
import { useChatBinding } from "./controller-context";
import { WhiteChatView } from "./white-chat-view";

export type ChatPanelProps = {
  controller: ChatController;
};

export function ChatPanel(props: ChatPanelProps): ReactElement {
  const agent = useAgent({ agentId: "default" });
  const copilotkit = useCopilotKit();
  const binding = useChatBinding();

  useEffect(() => {
    if (!agent.isReady || !agent.agent || !copilotkit.copilotkit) {
      props.controller.setAvailable(false);
      return;
    }

    const client = createCopilotChatClient({
      agent: agent.agent,
      copilotkit: copilotkit.copilotkit,
    });

    if (binding) {
      const detach = binding.attach(client);
      props.controller.setAvailable(true);
      return () => {
        detach();
      };
    }
  }, [agent.agent, agent.isReady, copilotkit.copilotkit, binding, props.controller]);

  return <CopilotChat chatView={WhiteChatView} />;
}
