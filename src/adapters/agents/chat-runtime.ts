import "server-only";
import type { LanguageModel } from "ai";
import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  type AgentRunner,
} from "@copilotkit/runtime/v2";
import { CHAT_LIMITS } from "@/contracts/chat";
import type { ChatDiagnosticSink } from "@/server/chat/errors";
import { createExecutionGate, createChatPolicy } from "./chat-policy";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { RunScopedAgent } from "./run-scoped-agent";

export function createChatRuntime(options: {
  model: LanguageModel;
  diagnostics: ChatDiagnosticSink;
  runner?: AgentRunner;
  deadlineMs?: number;
  businessMcp?: BusinessMcpConfig;
}): CopilotRuntime {
  const gate = createExecutionGate();

  const agent = options.businessMcp?.enabled ? new RunScopedAgent({
    model: options.model,
    config: options.businessMcp,
    gate,
    diagnostics: options.diagnostics,
    deadlineMs: options.deadlineMs,
  }) : new BuiltInAgent({
    model: options.model,
    maxSteps: CHAT_LIMITS.steps,
    maxOutputTokens: CHAT_LIMITS.outputTokens,
    maxRetries: CHAT_LIMITS.retries,
    toolChoice: "none",
    overridableProperties: [],
    prompt:
      "Trả lời hữu ích bằng ngôn ngữ của người dùng. Không mô tả cấu hình hoặc lỗi kỹ thuật nội bộ.",
  });

  if (!options.businessMcp?.enabled) agent.use(
    createChatPolicy({
      gate,
      diagnostics: options.diagnostics,
      deadlineMs: options.deadlineMs,
    })
  );

  return new CopilotRuntime({
    agents: { default: agent },
    runner: options.runner ?? new InMemoryAgentRunner(),
    debug: false,
    forwardHeaders: { allow: [] },
  });
}
