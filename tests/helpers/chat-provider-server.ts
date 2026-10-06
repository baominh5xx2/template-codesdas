import http from "node:http";
import { createChatProviderFixture, type ChatProviderScenario } from "./chat-provider";

const fixture = await createChatProviderFixture({ port: 4320 });
// Test-only loopback control plane. Successful chat still traverses Next, the
// installed SDK runtime and the fixture's OpenAI-compatible streaming endpoint.
const control = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/health") { res.end("{}"); return; }
  if (req.url === "/requests") { res.end(JSON.stringify(fixture.requests)); return; }
  if (req.url === "/scenario" && req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as { scenario: ChatProviderScenario; status?: 401 | 429 | 500; content?: string; chunkSize?: number; delayMs?: number };
    fixture.requests.length = 0;
    fixture.setScenario(body.scenario, body.status);
    fixture.setResponse(body.content ?? "Xin chào! Tôi có thể giúp gì cho bạn?", body.chunkSize, body.delayMs);
    res.end("{}"); return;
  }
  res.writeHead(404); res.end("{}");
});
control.listen(4321, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  control.close(); void fixture.close().then(() => process.exit(0));
});
