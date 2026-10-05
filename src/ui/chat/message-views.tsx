"use client";

import { CopilotChatAssistantMessage, CopilotChatUserMessage } from "@copilotkit/react-core/v2";
import type { ComponentProps, ReactElement } from "react";
import { useChatControllerRef } from "./controller-context";
import { CopyAction } from "./copy-action";

function EmptyToolbar(): null { return null; }

export function WhiteAssistantMessage(props: ComponentProps<typeof CopilotChatAssistantMessage>): ReactElement {
  const controller = useChatControllerRef();
  return <article className="chat-assistant-message">
    <CopilotChatAssistantMessage {...props} toolbarVisible={false} />
    <CopyAction content={props.message.content ?? ""} onFailure={controller.fail} />
  </article>;
}

export function WhiteUserMessage(props: ComponentProps<typeof CopilotChatUserMessage>): ReactElement {
  const controller = useChatControllerRef();
  // Match the installed SDK's text-part flattening for its broader UserMessage
  // type; C01 controller messages carry literal strings.
  const content = typeof props.message.content === "string" ? props.message.content
    : props.message.content.filter((part) => part.type === "text").map((part) => part.text).filter(Boolean).join("\n");
  return <article className="chat-user-message">
    <CopilotChatUserMessage {...props} toolbar={EmptyToolbar} />
    <CopyAction content={content} onFailure={controller.fail} />
  </article>;
}
