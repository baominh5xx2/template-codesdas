import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // The provider scenario is mutable; serialize consumers.
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    colorScheme: "dark",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chat-no-env", testMatch: "chat-no-env.spec.ts", use: { baseURL: "http://localhost:3212" } },
    { name: "chat-live", testMatch: /chat-(live|failures)\.spec\.ts/, use: { baseURL: "http://localhost:3211" } },
    { name: "chat-production", testMatch: "chat-production.spec.ts", use: { baseURL: "http://localhost:3212" } },
    { name: "baseline", testMatch: "baseline.spec.ts", use: { baseURL: "http://localhost:3211" } },
  ],
  webServer: [
    { command: "bun run tests/helpers/chat-provider-server.ts", url: "http://127.0.0.1:4321/health", reuseExistingServer: false },
    { command: "bun run tests/helpers/chat-web-server.ts live", url: "http://localhost:3211/api/health", reuseExistingServer: false, timeout: 120_000 },
    // Run bun run build first: production acceptance uses the real release build.
    { command: "bun run tests/helpers/chat-web-server.ts production", url: "http://localhost:3212/api/health", reuseExistingServer: false, timeout: 120_000 },
  ],
});
