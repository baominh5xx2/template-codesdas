"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
// eslint-disable-next-line no-restricted-imports
import { createChatClientBinding } from "@/adapters/agents/chat-client";
import { createChatController } from "./controller";
import { ChatControllerProvider } from "./controller-context";
import { useChatController } from "./use-controller";
import { useDesktopViewport } from "./use-desktop-viewport";
import { ChatShell } from "./shell";
import { SidebarShell } from "./sidebar-shell";
import { ChatHeader } from "./header";
import { ConversationLayout } from "./conversation-layout";
import { ChatComposer } from "./composer";
import { ConnectionNotice } from "./connection-notice";
import { ChatPanel } from "./chat-panel";
import { ChatErrorBoundary } from "./error-boundary";

function generateChatId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "chat-session-thread";
}

export type ChatWorkspaceProps = {
  threadId?: string;
};

export function ChatWorkspace({ threadId }: ChatWorkspaceProps = {}): ReactElement {
  const binding = useMemo(() => createChatClientBinding(), []);
  const controller = useMemo(
    () =>
      createChatController({
        port: binding.port,
        uuid: () => threadId || generateChatId(),
        available: false,
      }),
    [binding, threadId]
  );

  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  const snapshot = useChatController(controller);
  const desktop = useDesktopViewport();

  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [readiness, setReadiness] = useState<{ available: boolean }>({
    available: false,
  });

  const sidebarOpen = desktop ? !desktopCollapsed : mobileOpen;

  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/readiness");
      if (!res.ok) {
        setReadiness({ available: false });
        controller.setAvailable(false);
        controller.fail();
        return;
      }
      const data = (await res.json()) as { available?: boolean };
      const isAvailable = Boolean(data.available);
      setReadiness({ available: isAvailable });
      controller.setAvailable(false);
      if (!isAvailable) {
        controller.fail();
      }
    } catch {
      setReadiness({ available: false });
      controller.setAvailable(false);
      controller.fail();
    }
  }, [controller]);

  useEffect(() => {
    let active = true;
    const ac = new AbortController();

    async function initialCheck() {
      try {
        const res = await fetch("/api/chat/readiness", { signal: ac.signal });
        if (!active) return;
        if (!res.ok) {
          setReadiness({ available: false });
          controller.setAvailable(false);
          controller.fail();
          return;
        }
        const data = (await res.json()) as { available?: boolean };
        if (!active) return;
        const isAvailable = Boolean(data.available);
        setReadiness({ available: isAvailable });
        controller.setAvailable(false);
        if (!isAvailable) {
          controller.fail();
        }
      } catch {
        if (!active) return;
        setReadiness({ available: false });
        controller.setAvailable(false);
        controller.fail();
      }
    }

    void initialCheck();

    return () => {
      active = false;
      ac.abort();
    };
  }, [controller]);

  const handleNoticeRetry = useCallback(() => {
    if (!readiness.available) {
      void fetchReadiness();
    } else {
      void controller.retry();
    }
  }, [readiness.available, fetchReadiness, controller]);

  const isResettingRef = useRef(false);
  const handleNewChat = useCallback(async () => {
    if (isResettingRef.current) return;
    isResettingRef.current = true;
    try {
      await controller.newChat();
    } finally {
      isResettingRef.current = false;
    }
  }, [controller]);

  const hasNotice = snapshot.notice || !readiness.available;
  const noticeNode = hasNotice ? (
    <ConnectionNotice visible={true} onRetry={handleNoticeRetry} />
  ) : null;

  const connectedChat = (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      agentId="default"
      useSingleEndpoint={false}
      enableInspector={false}
      debug={false}
      showDevConsole={false}
      onError={({ code }) => {
        if (code === "runtime_info_fetch_failed") {
          setReadiness({ available: false });
          controller.setAvailable(false);
          controller.fail();
        }
        // Run errors are projected by the bridge's terminal sink. Discovery
        // failure unmounts the unavailable SDK and Retry checks readiness again.
      }}
    >
      <ChatPanel controller={controller} />
    </CopilotKitProvider>
  );

  const disconnectedChat = (
    <ConversationLayout
      transcript={
        <div className="chat-column">
          <h2 className="chat-welcome">Bạn muốn hỏi gì?</h2>
        </div>
      }
      composer={<ChatComposer controller={controller} notice={noticeNode} />}
    />
  );

  return (
      <ChatShell
        sidebar={
          <SidebarShell
            open={sidebarOpen}
            onClose={() => setMobileOpen(false)}
            onNewChat={handleNewChat}
            pending={snapshot.pending}
          />
        }
        header={
          <ChatHeader
            showSidebarToggle={true}
            onOpenSidebar={() => {
              if (desktop) {
                setDesktopCollapsed((prev) => !prev);
              } else {
                setMobileOpen(true);
              }
            }}
            sidebarOpen={sidebarOpen}
          />
        }
      >
        <ChatControllerProvider
          controller={controller}
          notice={noticeNode}
          binding={binding}
        >
          <ChatErrorBoundary
            onRetry={handleNoticeRetry}
            onFailure={() => {
              setReadiness({ available: false });
              controller.setAvailable(false);
              controller.fail();
            }}
            fallback={(retry) => (
              <ConversationLayout
                transcript={<div className="chat-column"><h2 className="chat-welcome">Bạn muốn hỏi gì?</h2></div>}
                composer={<ChatComposer controller={controller} notice={<ConnectionNotice visible onRetry={retry} />} />}
              />
            )}
          >
            {readiness.available ? connectedChat : disconnectedChat}
          </ChatErrorBoundary>
        </ChatControllerProvider>
      </ChatShell>
  );
}
