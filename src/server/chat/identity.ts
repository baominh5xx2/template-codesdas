import "server-only";
import type { Scope } from "@/contracts/common";

export function resolveLocalChatIdentity(): Scope {
  return {
    userId: "local-operator",
    workspaceId: "local-workspace",
    trustedOperator: false,
  };
}
