import { defineConfig, devices } from "@playwright/test";

const emptyChat = { CHAT_MODEL_BASE_URL: "", CHAT_MODEL_ID: "", CHAT_MODEL_API_KEY: "" };
const appServer = (port: number, distDir: string, configured = false) => ({
  command: `bun run dev --port ${port}`,
  url: `http://127.0.0.1:${port}/api/health`,
  reuseExistingServer: false,
  timeout: 60_000,
  env: { ...emptyChat, NEXT_TEST_DIST_DIR: distDir, ...(configured ? { CHAT_MODEL_BASE_URL: "http://127.0.0.1:4310/v1", CHAT_MODEL_ID: "test-chat" } : {}) },
});

export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1,
  timeout: 45_000, expect: { timeout: 10_000 }, reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [
    { name: "baseline", testMatch: "baseline.spec.ts", use: { baseURL: "http://127.0.0.1:3000" } },
    { name: "chat-no-env", testMatch: "chat-no-env.spec.ts", use: { baseURL: "http://127.0.0.1:3100" } },
    { name: "chat-live", testMatch: /chat-(live|failures)\.spec\.ts/, use: { baseURL: "http://127.0.0.1:3101" } },
    { name: "chat-production", testMatch: "chat-production.spec.ts", use: { baseURL: "http://127.0.0.1:3102" } },
  ],
  webServer: [
    { command: "bun run tsx tests/helpers/chat-provider-server.ts", url: "http://127.0.0.1:4310/test/health", reuseExistingServer: false, timeout: 60_000 },
    appServer(3000, ".next-e2e-baseline"), appServer(3100, ".next-e2e-no-env"), appServer(3101, ".next-e2e-live", true),
    { command: "bun run next start --hostname 127.0.0.1 --port 3102", url: "http://127.0.0.1:3102/api/health", reuseExistingServer: false, timeout: 60_000, env: { ...emptyChat, NEXT_TEST_DIST_DIR: "" } },
  ],
});
