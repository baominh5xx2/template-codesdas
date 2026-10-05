import { randomUUID } from "node:crypto";

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
  const response = await fetch(new URL("/api/copilotkit/agent/default/run", baseUrl), {
    method: "POST", signal, headers: { "Content-Type": "application/json", Origin: baseUrl.origin },
    body: JSON.stringify({ threadId: randomUUID(), runId: randomUUID(), state: {}, messages: [{ id: randomUUID(), role: "user", content: "Reply with a short greeting." }], tools: [], context: [], forwardedProps: {} }),
  });
  const stream = await response.text();
  if (stream.includes("RAW_SECRET_ERROR")) throw new Error("mask_failed");
  const completed = response.ok && stream.includes('"type":"RUN_FINISHED"') && !stream.includes('"type":"RUN_ERROR"');
  const masked = stream.includes("Chưa kết nối");
  if (!completed && !masked) throw new Error("terminal_failed");
  console.log(JSON.stringify({ readiness: true, result: completed ? "completed" : "masked_failure", checks: 3 }));
}
smoke().catch(() => { console.log(JSON.stringify({ result: "failed", checks: 0 })); process.exitCode = 1; });
