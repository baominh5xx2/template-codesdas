import type { ComponentProps, ReactElement } from "react";
import {
  CopilotChatAssistantMessage,
  CopilotChatUserMessage,
} from "@copilotkit/react-core/v2";
import { CopyAction } from "./copy-action";
import { useChatControllerRef } from "./controller-context";

function EmptyToolbar(): null {
  return null;
}

function extractMessageContent(message: { content?: unknown } | undefined): string {
  if (!message || message.content == null) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "type" in part && part.type === "text" && "text" in part &&
          typeof (part as { text: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function WhiteAssistantMessageImpl(
  props: ComponentProps<typeof CopilotChatAssistantMessage>
): ReactElement {
  const controller = useChatControllerRef();
  const textContent = extractMessageContent(props.message);

  return (
    <article className="chat-assistant-message">
      <CopilotChatAssistantMessage {...props} toolbarVisible={false} />
      <CopyAction content={textContent} onFailure={controller.fail} />
    </article>
  );
}

export const WhiteAssistantMessage = Object.assign(
  WhiteAssistantMessageImpl,
  CopilotChatAssistantMessage
);

function WhiteUserMessageImpl(
  props: ComponentProps<typeof CopilotChatUserMessage>
): ReactElement {
  const controller = useChatControllerRef();
  const textContent = extractMessageContent(props.message);

  return (
    <article className="chat-user-message">
      <CopilotChatUserMessage {...props} toolbar={EmptyToolbar} />
      <CopyAction content={textContent} onFailure={controller.fail} />
    </article>
  );
}

export const WhiteUserMessage = Object.assign(
  WhiteUserMessageImpl,
  CopilotChatUserMessage
);
