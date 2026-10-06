import { spawn } from "node:child_process";

const mode = process.argv[2];
if (!["live", "production"].includes(mode)) throw new Error("Unknown browser harness app");
const live = mode === "live";
const env = {
  ...process.env,
  CHAT_E2E_APP: mode,
  CHAT_MODEL_BASE_URL: live ? "http://127.0.0.1:4320/v1" : "",
  CHAT_MODEL_ID: live ? "test-model" : "",
  CHAT_MODEL_API_KEY: live ? "test-only-key" : "",
  NEXT_TELEMETRY_DISABLED: "1",
};
const port = live ? "3211" : "3212";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", mode === "production" ? "start" : "dev", "--hostname", "127.0.0.1", "--port", port], { env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
