import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { test, expect } from "@playwright/test";

type ModelRequest = { messages: Array<{ role: string; content: string }>; tools?: Array<{ function: { name: string } }> };
let app: ChildProcess | undefined;
let modelServer: http.Server | undefined;
let baseUrl: string;
let slow = false;
let reject = false;
const requests: ModelRequest[] = [];

async function listen(server: http.Server): Promise<number> {
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string" || address.port === 3100) throw new Error("No isolated test port");
  return address.port;
}

test.beforeAll(async () => {
  modelServer = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body: ModelRequest = JSON.parse(Buffer.concat(chunks).toString()); requests.push(body);
    if (reject) { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { message: "RAW_SECRET_BROWSER_MODEL" } })); return; }
    res.writeHead(200, { "content-type": "text/event-stream" });
    if (slow) { res.write(": waiting\n\n"); return; }
    const tool = body.messages.findLast((message) => message.role === "tool");
    const emit = (delta: object, finish_reason: string | null) => res.write(`data: ${JSON.stringify({ id: "chatcmpl-business-browser", object: "chat.completion.chunk", created: 1, model: "test-only-model", choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    if (tool) {
      const output = JSON.parse(tool.content);
      emit({ role: "assistant", content: `Tổng ${output.totalMinor}, còn lại ${output.remainingMinor}` }, null); emit({}, "stop");
    } else {
      emit({ role: "assistant", tool_calls: [{ index: 0, id: "browser-budget-call", type: "function", function: { name: "business__calculate_budget", arguments: JSON.stringify({ currency: "VND", budgetMinor: 200000, items: [{ label: "Room", amountMinor: 120000 }, { label: "Food", amountMinor: 85000 }] }) } }] }, null); emit({}, "tool_calls");
    }
    res.end("data: [DONE]\n\n");
  });
  const modelPort = await listen(modelServer);
  const reservation = http.createServer(); const appPort = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  baseUrl = `http://127.0.0.1:${appPort}`;
  // Pass only operating-system settings and synthetic test configuration.
  const systemEnv = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA"].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
  app = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(appPort)], { cwd: process.cwd(), windowsHide: true, stdio: "pipe", env: {
    ...systemEnv, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    CHAT_MODEL_BASE_URL: `http://127.0.0.1:${modelPort}/v1`, CHAT_MODEL_ID: "test-only-model", CHAT_MODEL_API_KEY: "synthetic-model-token",
    BUSINESS_MCP_ENABLED: "true", BUSINESS_MCP_URL: `http://127.0.0.1:${appPort}/api/mcp/business`, BUSINESS_MCP_TOKEN: "synthetic-business-token", BUSINESS_MCP_TOOLS: "calculate_budget", BUSINESS_MCP_ALLOWED_HOSTS: "127.0.0.1", BUSINESS_MCP_ALLOWED_ORIGINS: baseUrl,
  } });
  let output = ""; app.stdout?.on("data", (chunk) => { output += chunk; }); app.stderr?.on("data", (chunk) => { output += chunk; });
  await expect.poll(async () => { if (app?.exitCode !== null) throw new Error(`Isolated app exited: ${output}`); try { return (await fetch(`${baseUrl}/api/chat/readiness`)).status; } catch { return 0; } }, { timeout: 20_000 }).toBe(200);
});

test.afterAll(async () => {
  if (app && app.exitCode === null) { const exited = once(app, "exit"); app.kill(); await exited; }
  if (modelServer) { modelServer.closeAllConnections(); await new Promise<void>((resolve) => modelServer!.close(() => resolve())); }
});

test("Send, inline result, Copy, follow-up, failure Retry, Stop Retry and New chat in the C01 white UI", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
  await page.route("**/*", async (route) => { const url = new URL(route.request().url()); if (url.protocol.startsWith("http") && url.origin !== baseUrl) await route.abort(); else await route.continue(); });
  await page.goto(baseUrl);
  const composer = page.getByRole("textbox", { name: "Tin nhắn" });
  await composer.fill("Tính ngân sách thật"); await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(page.getByText("205.000 VND", { exact: true })).toBeVisible(); await expect(page.getByText("Vượt ngân sách", { exact: true })).toBeVisible();
  await expect(page.getByText("Tổng 205000, còn lại -5000", { exact: true })).toBeVisible();
  expect(requests[0].tools?.map((tool) => tool.function.name)).toContain("business__calculate_budget");
  await page.locator(".chat-assistant-message").getByRole("button", { name: "Sao chép", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Tổng 205000, còn lại -5000");
  await composer.fill("Nhắc lại số còn lại"); await composer.press("Enter");
  await expect(page.locator(".chat-assistant-message")).toHaveCount(2);
  expect(requests.at(-1)?.messages.some((message) => message.role === "tool" && message.content.includes('"remainingMinor":-5000'))).toBe(true);
  reject = true;
  await composer.fill("Câu cần thử lại"); await composer.press("Enter");
  await expect(page.getByText("Chưa kết nối", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa kết nối", { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("copilot-error-banner")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show Details", exact: true })).toHaveCount(0);
  await expect(page.getByText("RAW_SECRET_BROWSER_MODEL")).toHaveCount(0);
  reject = false; await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".chat-assistant-message")).toHaveCount(3);
  await expect(page.getByText("Câu cần thử lại", { exact: true })).toHaveCount(1);
  slow = true;
  await composer.fill("Câu sẽ dừng"); await composer.press("Enter");
  await expect.poll(() => requests.at(-1)?.messages.at(-1)?.content).toBe("Câu sẽ dừng");
  await page.getByRole("button", { name: "Dừng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await expect(page.getByText("Chưa kết nối", { exact: true })).toHaveCount(0);
  slow = false; await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".chat-assistant-message")).toHaveCount(4);
  await expect(page.getByText("Câu sẽ dừng", { exact: true })).toHaveCount(1);
  expect(requests.at(-1)?.messages.filter((message) => message.role === "user" && message.content === "Câu sẽ dừng")).toHaveLength(1);
  await page.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true }).click();
  await expect(page.locator(".chat-tool-card")).toHaveCount(0); await expect(page.locator(".chat-user-message")).toHaveCount(0); await expect(composer).toHaveValue("");
});
