"use client";

import { useSyncExternalStore } from "react";
import type { ChatController, ChatSnapshot } from "./controller";

export function useChatController(controller: ChatController): ChatSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
