import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(new URL("../.env.docker", import.meta.url))) {
  console.error("Run bun run docker:setup first.");
  process.exit(1);
}
const result = spawnSync("docker", [
  "compose", "--project-name", "hackathon-starter-core",
  "--env-file", ".env.docker", "--file", "compose.yaml",
  ...process.argv.slice(2),
], { cwd: root, stdio: "inherit" });
if (result.error) console.error("Docker could not start. Check Docker Desktop and the Docker CLI.");
process.exit(result.status ?? 1);
