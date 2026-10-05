"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
// eslint-disable-next-line no-restricted-imports -- Browser-safe C01 binding uses CopilotKit's HTTP runtime endpoint.
import { createChatClientBinding } from "@/adapters/agents/chat-client";
import { createChatController } from "./controller";
import { useChatController } from "./use-controller";
import { ChatControllerProvider } from "./controller-context";
import { ChatShell } from "./shell";
import { ChatHeader } from "./header";
import { SidebarShell } from "./sidebar-shell";
import { useDesktopViewport } from "./use-desktop-viewport";
import { ConnectionNotice } from "./connection-notice";
import { ChatFallback } from "./white-chat-view";
import { ChatBindingContext, ChatPanel } from "./chat-panel";
import { ChatErrorBoundary } from "./error-boundary";

export function ChatWorkspace(): ReactElement {
  const [binding] = useState(createChatClientBinding);
  const [controller] = useState(() => createChatController({ port: binding.port, available: false, uuid: () => crypto.randomUUID() }));
  const snapshot = useChatController(controller);
  const desktop = useDesktopViewport();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [previousDesktop, setPreviousDesktop] = useState(desktop);
  // Reset during render so a stale drawer never opens on a breakpoint transition.
  if (desktop !== previousDesktop) {
    setPreviousDesktop(desktop);
    setMobileOpen(false);
  }
  const [readiness, setReadiness] = useState(false);
  const [providerGeneration, setProviderGeneration] = useState(0);
  const readinessAbort = useRef<AbortController | null>(null);
  const readinessGeneration = useRef(0);
  const resetting = useRef(false);

  const checkReadiness = useCallback(() => {
    const generation = ++readinessGeneration.current;
    readinessAbort.current?.abort();
    const abort = new AbortController();
    readinessAbort.current = abort;
    void fetch("/api/chat/readiness", { cache: "no-store", signal: abort.signal })
      .then((response) => response.ok ? response.json() as Promise<unknown> : null)
      .then((result) => {
        if (abort.signal.aborted || generation !== readinessGeneration.current) return;
        setReadiness(typeof result === "object" && result !== null && "available" in result
          && result.available === true && "agentId" in result && result.agentId === "default");
      }).catch(() => {
        if (!abort.signal.aborted && generation === readinessGeneration.current) setReadiness(false);
      });
  }, []);

  const retryReadiness = () => {
    controller.setAvailable(false);
    setReadiness(false);
    setProviderGeneration((value) => value + 1);
    void checkReadiness();
  };

  const cancelReadiness = useCallback(() => {
    ++readinessGeneration.current;
    readinessAbort.current?.abort();
  }, []);

  useEffect(() => {
    void checkReadiness();
    return () => { cancelReadiness(); controller.dispose(); };
  }, [cancelReadiness, checkReadiness, controller]);

  const retry = () => {
    if (snapshot.pending) return;
    if (!snapshot.available) { retryReadiness(); return; }
    // Provider/chat errors set the controller's failure fence; clear it before checkpoint retry.
    controller.setAvailable(true);
    void controller.retry();
    // A pre-start failure restores draft without a checkpoint; retry acquires pending synchronously when it has one.
    const afterRetry = controller.getSnapshot();
    if (!afterRetry.pending && afterRetry.draft.trim()) void controller.send();
  };
  const newChat = async () => {
    if (resetting.current) return;
    resetting.current = true;
    try { await controller.newChat(); }
    finally { resetting.current = false; }
  };
  const notice = !snapshot.available || snapshot.notice
    ? <ConnectionNotice visible onRetry={retry} /> : null;
  const sidebar = <SidebarShell open={desktop ? !desktopCollapsed : mobileOpen}
    onClose={() => { if (desktop) setDesktopCollapsed(true); else setMobileOpen(false); }}
    onNewChat={() => { void newChat(); }} pending={snapshot.pending} />;
  const header = <ChatHeader showSidebarToggle={!desktop || desktopCollapsed}
    onOpenSidebar={() => { if (desktop) setDesktopCollapsed(false); else setMobileOpen(true); }} />;
  const connectedChat = <ChatErrorBoundary key={providerGeneration} onRetry={retry}>
    <ChatBindingContext.Provider value={binding}>
      <CopilotKitProvider runtimeUrl="/api/copilotkit" agentId="default" useSingleEndpoint={false}
        enableInspector={false} debug={false} onError={() => controller.fail()}>
        <ChatPanel controller={controller} />
      </CopilotKitProvider>
    </ChatBindingContext.Provider>
  </ChatErrorBoundary>;
  return <ChatShell sidebar={sidebar} header={header}>
    <ChatControllerProvider controller={controller} notice={notice}>
      {readiness ? connectedChat : <ChatFallback controller={controller} notice={notice} />}
    </ChatControllerProvider>
  </ChatShell>;
}
