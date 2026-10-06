import { createChatProviderFixture } from "./chat-provider";

// Test process only: never imported by application code or the production registry.
const fixture = await createChatProviderFixture({ port: 4310, controlRoutes: true });
async function shutdown() {
  await fixture.close();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
