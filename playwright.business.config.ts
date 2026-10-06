import { defineConfig } from "@playwright/test";

/** Isolated acceptance server uses synthetic credentials and an OS-assigned port.
 * Run after bun run build: bun run e2e --config playwright.business.config.ts */
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "business-chat.spec.ts", workers: 1, reporter: "list",
  timeout: 60_000,
  use: { channel: "chrome", headless: true, viewport: { width: 1280, height: 900 } },
});
