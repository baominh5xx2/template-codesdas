import http from "node:http";
import type { Socket } from "node:net";

export type ChatProviderScenario = "success" | "reject" | "partial-fail" | "slow";

export type CapturedRequest = {
  body: unknown;
  authorization: string | null;
  aborted: boolean;
};

export type ChatProviderFixture = {
  baseUrl: string;
  requests: CapturedRequest[];
  setScenario(scenario: ChatProviderScenario, rejectStatus?: 401 | 429 | 500): void;
  close(): Promise<void>;
};

export type ChatProviderOptions = {
  port?: number;
  scenario?: ChatProviderScenario;
  rejectStatus?: 401 | 429 | 500;
};

export async function createChatProviderFixture(
  options?: ChatProviderOptions
): Promise<ChatProviderFixture> {
  let currentScenario: ChatProviderScenario = options?.scenario ?? "success";
  let currentRejectStatus: 401 | 429 | 500 = options?.rejectStatus ?? 401;

  const requests: CapturedRequest[] = [];
  const sockets = new Set<Socket>();
  const activeTimers = new Set<NodeJS.Timeout>();

  const server = http.createServer(async (req, res) => {
    let aborted = false;
    req.on("close", () => {
      if (!res.writableEnded) {
        aborted = true;
      }
    });

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf-8");
    let parsedBody: unknown = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody;
    }

    const captured: CapturedRequest = {
      body: parsedBody,
      authorization: req.headers["authorization"] ?? null,
      get aborted() {
        return aborted || req.destroyed;
      },
    };
    requests.push(captured);

    if (req.url && (req.url.endsWith("/chat/completions") || req.url.includes("/chat/completions"))) {
      if (currentScenario === "reject") {
        res.writeHead(currentRejectStatus, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "RAW_SECRET_ERROR: unauthorized key or model execution failure",
              type: "invalid_request_error",
              code: "invalid_api_key",
            },
          })
        );
        return;
      }

      if (currentScenario === "slow") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(": keepalive\n\n");
        // Keep connection open indefinitely until aborted or closed
        return;
      }

      if (currentScenario === "partial-fail") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(
          `data: ${JSON.stringify({
            id: "chatcmpl-test-partial",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "test-model",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "Một phần phản hồi" },
                finish_reason: null,
              },
            ],
          })}\n\n`
        );

        const timer = setTimeout(() => {
          activeTimers.delete(timer);
          if (!res.destroyed) {
            res.write(`data: RAW_SECRET_ERROR {corrupt json\n\n`);
            res.destroy(new Error("Stream connection failed abruptly"));
          }
        }, 30);
        activeTimers.add(timer);
        return;
      }

      // Default: success
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(
        `data: ${JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "test-model",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Xin chào! Tôi có thể giúp gì cho bạn?" },
              finish_reason: null,
            },
          ],
        })}\n\n`
      );
      res.write(
        `data: ${JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "test-model",
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop",
            },
          ],
        })}\n\n`
      );
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options?.port ?? 0, "127.0.0.1", () => {
      resolve();
    });
    server.once("error", reject);
  });

  const address = server.address();
  const assignedPort = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${assignedPort}/v1`;

  return {
    baseUrl,
    requests,
    setScenario(scenario: ChatProviderScenario, rejectStatus?: 401 | 429 | 500) {
      currentScenario = scenario;
      if (rejectStatus) currentRejectStatus = rejectStatus;
    },
    async close() {
      for (const timer of activeTimers) {
        clearTimeout(timer);
      }
      activeTimers.clear();

      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();

      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
