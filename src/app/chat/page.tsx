import type { Metadata } from "next";
import { ChatWorkspace } from "@/ui/chat/workspace";

export const metadata: Metadata = {
  title: "TriplePeek Studio · AI Thực chiến",
  description: "Trợ lý coding của nhóm TriplePeek tại AI Thực chiến.",
};

export default function ChatPage() {
  return <ChatWorkspace />;
}
