import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

async function smokeRun(body: (run: { threadId: string; runId: string }) => string, status = 200, contentType = "text/event-stream") {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/health") { res.end(JSON.stringify({ status: "ok" })); return; }
    if (req.url === "/api/chat/readiness") { res.end(JSON.stringify({ available: true })); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const run = JSON.parse(Buffer.concat(chunks).toString());
    res.writeHead(status, { "Content-Type": contentType }); res.end(body(run));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    const result = await promisify(execFile)("bun", ["run", "chat:smoke"], { env: { ...process.env, CHAT_SMOKE_URL: `http://127.0.0.1:${address.port}` } }).catch((error: { stdout: string; stderr: string; code: number }) => error);
    return { ...JSON.parse(result.stdout.trim()), output: result.stdout + result.stderr, exitCode: "code" in result ? result.code : 0 };
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

describe("chat smoke terminal contract", () => {
  it("accepts structured masked HTTP failure", async () => {
    expect((await smokeRun(() => JSON.stringify({ code: "chat_unavailable", message: "Chưa kết nối" }), 503, "application/json")).result).toBe("masked_failure");
  });
  it("accepts valid complete SSE success and masked error terminals", async () => {
    expect((await smokeRun((run) => `data: ${JSON.stringify({ type: "RUN_FINISHED", ...run })}\n\n`)).result).toBe("completed");
    expect((await smokeRun(() => `data: ${JSON.stringify({ type: "RUN_ERROR", message: "Chưa kết nối" })}\n\n`)).result).toBe("masked_failure");
  });
  for (const body of ["plain Chưa kết nối", '{"message":"Chưa kết nối"}', 'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"a","delta":"Chưa kết nối"}\n\n', 'data: {"type":"RUN_ERROR","message":"Chưa kết nối"}', 'data: {"type":"RUN_FINISHED"}\n\n', 'data: {"type":"RUN_ERROR","message":"Chưa kết nối","rawEvent":"provider_detail"}\n\n', 'unexpected body\n\ndata: {"type":"RUN_ERROR","message":"Chưa kết nối"}\n\n', 'data: {"type":"RUN_ERROR","message":"RAW_SECRET_ERROR"}\n\ndata: {"type":"RUN_ERROR","message":"Chưa kết nối"}\n\n']) {
    it(`rejects incomplete/unstructured body ${JSON.stringify(body)}`, async () => {
      const result = await smokeRun(() => body);
      expect(result.result).toBe("failed"); expect(result.exitCode).toBe(1);
      expect(result.output).not.toContain("Chưa kết nối"); expect(result.output).not.toContain("RAW_SECRET_ERROR");
    });
  }
  it("rejects mismatched success IDs and events following a terminal", async () => {
    expect((await smokeRun(() => 'data: {"type":"RUN_FINISHED","threadId":"wrong","runId":"wrong"}\n\n')).result).toBe("failed");
    expect((await smokeRun((run) => `data: ${JSON.stringify({ type: "RUN_FINISHED", threadId: run.threadId, runId: run.runId })}\n\ndata: {"type":"RUN_ERROR","message":"Chưa kết nối"}\n\n`)).result).toBe("failed");
  });
  it("rejects HTTP copy without the exact safe envelope", async () => {
    expect((await smokeRun(() => JSON.stringify({ message: "Chưa kết nối" }), 503, "application/json")).result).toBe("failed");
    expect((await smokeRun(() => JSON.stringify({ code: "chat_unavailable", message: "Chưa kết nối", error: "provider_detail" }), 503, "application/json")).result).toBe("failed");
  });
});
