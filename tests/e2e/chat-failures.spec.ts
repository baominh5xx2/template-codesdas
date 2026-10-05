import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { answer, observe, openChat, scenario, send } from "../helpers/chat-browser";

for (const value of ["reject", "partial-fail"] as const) {
  test(`${value} masks provider details and repeated Retry preserves one user ID`, async ({ page, request }) => {
    await scenario(request, value);
    const observed = observe(page); await openChat(page); await send(page, "Recover this turn");
    await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
    await expect(page.getByRole("button", { name: "Dừng" })).toHaveCount(0);
    if (value === "partial-fail") await expect(page.locator(".chat-assistant-message")).toContainText("Một phần phản hồi");
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await expect.poll(() => observed.runs.length).toBe(i + 2);
      await expect(page.getByRole("button", { name: "Dừng" })).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveCount(1);
    }
    await scenario(request, "success"); await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(page.locator(".chat-assistant-message")).toContainText(answer);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator(".chat-user-message")).toHaveCount(1);
    const ids = observed.runs.flatMap((run) => run.messages.filter((msg) => msg.role === "user").map((msg) => msg.id));
    expect(ids).toHaveLength(4); expect(new Set(ids).size).toBe(1);
    expect(observed.runs[3].messages).toHaveLength(1);
    await observed.assertMasked();
  });
}

for (const outage of ["network", "timeout"] as const) {
  test(`${outage} transport interruption releases loading and preserves draft`, async ({ page, request }) => {
    await scenario(request, "success"); const observed = observe(page); await openChat(page);
    await page.route("**/api/copilotkit/agent/default/run", (route) => route.abort(outage === "timeout" ? "timedout" : "connectionfailed"));
    await send(page, "Transport draft"); await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
    await expect(page.getByRole("button", { name: "Dừng" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Tin nhắn" })).toHaveValue("Transport draft");
    await page.unroute("**/api/copilotkit/agent/default/run"); await send(page, "Transport recovered");
    await expect(page.locator(".chat-assistant-message")).toContainText(answer);
    await expect(page.getByRole("status")).toHaveCount(0); await observed.assertMasked();
  });
}

for (const endpoint of ["/api/chat/readiness", "/api/copilotkit/info"]) {
  test(`${endpoint} discovery outage exposes one safe notice`, async ({ page, request }) => {
    await scenario(request, "success"); const observed = observe(page);
    let failures = 0;
    await page.route(`**${endpoint}`, (route) => { failures++; return route.abort("connectionfailed"); }); await page.goto("/");
    await expect.poll(() => failures).toBeGreaterThan(0);
    await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
    await expect(page.getByRole("status")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled();
    await page.unroute(`**${endpoint}`);
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(page.getByRole("status")).toHaveCount(0);
    await send(page, "Discovery recovered");
    await expect(page.locator(".chat-assistant-message")).toContainText(answer); await observed.assertMasked();
  });
}

test("clipboard failure stays masked", async ({ page, request }) => {
  await scenario(request, "success");
  // Clipboard failure calls the same local failure boundary without injecting production flags.
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("RAW_SECRET_ERROR")) }, configurable: true }); });
  const observed = observe(page); await openChat(page); await send(page, "Copy failure");
  await expect(page.locator(".chat-assistant-message")).toContainText(answer);
  await page.locator(".chat-assistant-message").getByRole("button", { name: "Sao chép" }).click();
  await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
  await expect(page.getByRole("status")).toHaveCount(1); await observed.assertMasked();
});

test("renderer exception displays the safe fallback and Retry remounts", async ({ page, request }) => {
  await scenario(request, "success");
  const observed = observe(page);
  await page.addInitScript(() => {
    const original = document.createElement.bind(document);
    document.createElement = ((...args: Parameters<typeof document.createElement>) => {
      if (args[0] === "article" && document.documentElement.hasAttribute("data-test-render-failure")) {
        throw new Error("controlled_renderer_failure");
      }
      return original(...args);
    }) as typeof document.createElement;
  });
  await openChat(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-test-render-failure", "true"));
  await send(page, "Render failure");
  await expect(page.locator(".chat-error-boundary-view")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.locator(".chat-shell").getByText("controlled_renderer_failure", { exact: false })).toHaveCount(0);
  await observed.assertMasked();
  await observed.assertResponsesExclude("controlled_renderer_failure");
  // React/Next development caught-error diagnostics belong to the framework;
  // retain their source as evidence, rather than hiding/filtering observations.
  const frameworkDiagnostics = observed.consoleEvents.filter((event) => event.text.includes("controlled_renderer_failure"));
  for (const message of observed.consoleMessages.filter((text) => text.includes("controlled_renderer_failure"))) {
    expect(frameworkDiagnostics.some((event) => event.text === message &&
      event.source.includes("/_next/static/chunks/node_modules_next_dist_") &&
      event.text.includes("The above error occurred in the <article> component. It was handled by the <ChatErrorBoundary> error boundary."))).toBe(true);
  }
  const diagnosticsPath = test.info().outputPath("renderer-framework-diagnostics.json");
  await writeFile(diagnosticsPath, JSON.stringify(frameworkDiagnostics, null, 2));
  await test.info().attach("renderer-framework-diagnostics", { path: diagnosticsPath, contentType: "application/json" });
  await page.evaluate(() => document.documentElement.removeAttribute("data-test-render-failure"));
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.locator(".chat-error-boundary-view")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("[data-copilotkit]").first()).toBeAttached();
  await page.getByRole("textbox", { name: "Tin nhắn" }).fill("Renderer recovered");
  await expect(page.getByRole("button", { name: "Gửi", exact: true })).toBeEnabled();
  await send(page, "Renderer recovered");
  await expect(page.locator(".chat-assistant-message").last()).toContainText(answer);
  await expect(page.getByRole("button", { name: "Dừng", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(observed.runs.at(-1)?.messages.at(-1)?.content).toBe("Renderer recovered");
  await expect(page.locator(".chat-shell").getByText("controlled_renderer_failure", { exact: false })).toHaveCount(0);
  await observed.assertResponsesExclude("controlled_renderer_failure");
  await observed.assertMasked();
});
