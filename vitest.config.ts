import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      "server-only": path.join(root, "tests/helpers/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Let Vite transform the SDK so its CSS side-effect imports are stubbed; composer tests run the real CopilotChatInput.
    server: { deps: { inline: [/@copilotkit\/react-core/] } },
  },
});
