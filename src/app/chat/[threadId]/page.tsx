import type { Metadata } from "next";
import { ChatWorkspace } from "@/ui/chat/workspace";

type Props = {
  params: Promise<{ threadId: string }>;
};

export const metadata: Metadata = {
  title: "TriplePeek Studio · AI Thực chiến",
  description: "Trợ lý coding của nhóm TriplePeek tại AI Thực chiến.",
};

export default async function ChatThreadPage({ params }: Props) {
  const resolved = await params;
  return <ChatWorkspace threadId={resolved.threadId} />;
}
