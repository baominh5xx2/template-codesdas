export const CHAT_NOTICE = "Chưa kết nối";

export const CHAT_LIMITS = {
  inputChars: 8_000,
  bodyBytes: 262_144,
  deadlineMs: 120_000,
  outputTokens: 2_048,
  retries: 0,
  steps: 1,
} as const;

export type ChatReadiness = {
  available: boolean;
  agentId: "default";
};

export type ChatExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";
