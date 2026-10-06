import { randomUUID } from "node:crypto";
import { EventSchemas } from "@ag-ui/core/schemas";

function terminalResult(response: Response, body: string, threadId: string, runId: string): "completed" | "masked_failure" {
  if (body.includes("RAW_SECRET_ERROR")) throw new Error("mask_failed");
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (!response.ok && contentType === "application/json") {
    const error = JSON.parse(body);
    if (error?.code === "chat_unavailable" && error.message === "Chưa kết nối" &&
      Object.keys(error).every((key) => key === "code" || key === "message")) return "masked_failure";
  }
  if (!response.ok || contentType !== "text/event-stream" || !/\r?\n\r?\n$/.test(body)) throw new Error("terminal_failed");
  const events = body.split(/\r?\n\r?\n/).flatMap((block) => {
    const lines = block.split(/\r?\n/);
    if (lines.some((line) => line && !line.startsWith(":") && !/^(data|event|id|retry):/.test(line))) throw new Error("stream_failed");
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    return data ? [EventSchemas.parse(JSON.parse(data))] : [];
  });
  if (events.slice(0, -1).some((event) => event.type === "RUN_ERROR" || event.type === "RUN_FINISHED")) throw new Error("terminal_failed");
  const terminal = events.at(-1);
  if (terminal?.type === "RUN_ERROR" && terminal.message === "Chưa kết nối" &&
    Object.keys(terminal).every((key) => key === "type" || key === "message")) return "masked_failure";
  if (terminal?.type === "RUN_FINISHED" && terminal.threadId === threadId && terminal.runId === runId &&
    (!terminal.outcome || terminal.outcome.type === "success") && !events.some((event) => event.type === "RUN_ERROR")) return "completed";
  throw new Error("terminal_failed");
}

async function smoke() {
  const baseUrl = new URL(process.env.CHAT_SMOKE_URL || "http://127.0.0.1:3100");
  const signal = AbortSignal.timeout(130_000);
  const health = await fetch(new URL("/api/health", baseUrl), { signal });
  if (!health.ok || (await health.json()).status !== "ok") throw new Error("health_failed");
  const readinessResponse = await fetch(new URL("/api/chat/readiness", baseUrl), { signal });
  if (!readinessResponse.ok) throw new Error("readiness_failed");
  const readiness = await readinessResponse.json();
  if (!readiness.available) {
    const response = await fetch(new URL("/api/copilotkit/info", baseUrl), { signal });
    if (response.status !== 503 || (await response.json()).message !== "Chưa kết nối") throw new Error("unavailable_contract_failed");
    console.log(JSON.stringify({ readiness: false, result: "unavailable_contract_pass", checks: 3 }));
    return;
  }
  const threadId = randomUUID(); const runId = randomUUID();
  const response = await fetch(new URL("/api/copilotkit/agent/default/run", baseUrl), {
    method: "POST", signal, headers: { "Content-Type": "application/json", Origin: baseUrl.origin },
    body: JSON.stringify({ threadId, runId, state: {}, messages: [{ id: randomUUID(), role: "user", content: "Reply with a short greeting." }], tools: [], context: [], forwardedProps: {} }),
  });
  const stream = await response.text();
  console.log(JSON.stringify({ readiness: true, result: terminalResult(response, stream, threadId, runId), checks: 3 }));
}
smoke().catch(() => { console.log(JSON.stringify({ result: "failed", checks: 0 })); process.exitCode = 1; });
