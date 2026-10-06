import "server-only";
import type { MCPClientProvider } from "@copilotkit/runtime/v2";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import type { BusinessTool } from "@/core/tools/definition";
import { createBusinessToolCatalog } from "@/server/mcp/catalog";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import { createBusinessClient } from "./business-client";
import { createBusinessToolProvider } from "./tool-provider";
import { assertBusinessBytes, BusinessMcpFailure, decodeBusinessResult } from "./results";

export const BUSINESS_RUN_LIMITS = { discoveryMs: 5_000, callMs: 15_000, runMs: 120_000, calls: 3 } as const;

function waitForTurn(previous: Promise<void>, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { reject(new BusinessMcpFailure("cancelled")); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    previous.then(() => { signal.removeEventListener("abort", abort); if (signal.aborted) abort(); else resolve(); });
  });
}

/** One client and cancellation domain per execution. Queued time consumes call deadline. */
export async function createBusinessRunScope(options: {
  config: BusinessMcpConfig; threadId: string; runId: string; signal: AbortSignal;
  now?: () => number; fetch?: typeof fetch; definitions?: readonly BusinessTool<unknown, unknown>[];
  onFailure?: (failure: BusinessMcpFailure) => void;
}) {
  if (!options.config.enabled) throw new BusinessMcpFailure("disabled");
  const now = options.now ?? Date.now;
  const controller = new AbortController();
  const deadline = now() + BUSINESS_RUN_LIMITS.runMs;
  const { client, transport } = createBusinessClient(options.config, controller.signal, options.fetch);
  let closed: Promise<void> | undefined;
  let terminalReason: "cancelled" | "failed" | undefined;
  let tail = Promise.resolve(); let calls = 0;
  const externalAbort = () => { void cancel(); };
  options.signal.addEventListener("abort", externalAbort, { once: true });
  const runTimer = setTimeout(() => { fail(new BusinessMcpFailure("run_timeout")); }, BUSINESS_RUN_LIMITS.runMs);
  function close(): Promise<void> {
    if (closed) return closed;
    controller.abort(); clearTimeout(runTimer); options.signal.removeEventListener("abort", externalAbort);
    closed = client.close().catch(() => {});
    return closed;
  }
  function cancel(): Promise<void> {
    // Latch the reason before aborting shared resources: queued siblings may
    // immediately observe the controller abort with their own signals still live.
    terminalReason ??= "cancelled";
    return close();
  }
  function fail(failure: BusinessMcpFailure): BusinessMcpFailure {
    if (!terminalReason && !options.signal.aborted) { terminalReason = "failed"; try { options.onFailure?.(failure); } catch { /* A sink must not break cancellation or leak its error. */ } }
    controller.abort(); void close(); return failure;
  }
  client.onclose = () => { if (!controller.signal.aborted) fail(new BusinessMcpFailure("disconnected")); };
  const discoveryAbort = new AbortController();
  const discoveryTimer = setTimeout(() => { discoveryAbort.abort(); fail(new BusinessMcpFailure("discovery_timeout")); }, BUSINESS_RUN_LIMITS.discoveryMs);
  try {
    if (options.signal.aborted) externalAbort();
    controller.signal.throwIfAborted();
    const discoverySignal = AbortSignal.any([controller.signal, discoveryAbort.signal]);
    await client.connect(transport, { signal: discoverySignal, timeout: BUSINESS_RUN_LIMITS.discoveryMs });
    if (client.getProtocolEra() !== "modern") throw new BusinessMcpFailure("legacy_protocol_denied");
    // Explicit cursor requests one bounded page; pagination is unsupported for
    // this finite local catalog and cannot grow an unbounded aggregate in the SDK.
    const listed = await client.listTools({ cursor: "" }, { signal: discoverySignal, timeout: BUSINESS_RUN_LIMITS.discoveryMs });
    if (listed.nextCursor) throw new BusinessMcpFailure("discovery_invalid");
    controller.signal.throwIfAborted();
    const catalog = createBusinessToolCatalog(options.definitions ?? [calculateBudgetTool], options.config.enabledTools);
    const provider: MCPClientProvider = createBusinessToolProvider(catalog, listed.tools, async (registration, args, execution) => {
      const callAbort = new AbortController();
      const signal = AbortSignal.any([controller.signal, callAbort.signal, ...(execution.abortSignal ? [execution.abortSignal] : [])]);
      const remaining = Math.min(BUSINESS_RUN_LIMITS.callMs, deadline - now());
      const timer = setTimeout(() => { callAbort.abort(); fail(new BusinessMcpFailure("call_timeout")); }, Math.max(0, remaining));
      let release: (() => void) | undefined;
      try {
        signal.throwIfAborted();
        if (remaining <= 0) throw new BusinessMcpFailure("run_timeout");
        if (++calls > BUSINESS_RUN_LIMITS.calls) throw new BusinessMcpFailure("call_budget_exceeded");
        assertBusinessBytes(args);
        const input = registration.definition.input.safeParse(args);
        if (!input.success) throw new BusinessMcpFailure("input_invalid");
        const previous = tail;
        tail = new Promise<void>((resolve) => { release = resolve; });
        await waitForTurn(previous, signal);
        const result = await client.callTool({ name: registration.definition.name, arguments: input.data as Record<string, unknown> }, { signal, timeout: Math.max(1, Math.min(remaining, deadline - now())) });
        signal.throwIfAborted();
        return decodeBusinessResult(registration, result);
      } catch (error) {
        if (terminalReason === "cancelled" || options.signal.aborted || execution.abortSignal?.aborted) { await cancel(); throw new BusinessMcpFailure("cancelled"); }
        throw fail(error instanceof BusinessMcpFailure ? error : new BusinessMcpFailure(signal.aborted ? "cancelled" : "tool_failed"));
      } finally { clearTimeout(timer); release?.(); }
    });
    return { client, provider, signal: controller.signal, deadline, threadId: options.threadId, runId: options.runId, close };
  } catch (error) {
    const failure = fail(error instanceof BusinessMcpFailure ? error : new BusinessMcpFailure("discovery_failed"));
    await close(); throw failure;
  } finally { clearTimeout(discoveryTimer); }
}
