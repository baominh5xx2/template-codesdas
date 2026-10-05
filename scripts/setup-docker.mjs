import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const target = new URL(".env.docker", root);
if (existsSync(target)) {
  console.log(".env.docker already exists; existing credentials were kept.");
} else {
  let template = readFileSync(new URL(".env.docker.example", root), "utf8");
  template = template.replaceAll("GENERATE_LOCALLY", () => randomBytes(32).toString("hex"));
  writeFileSync(target, template, { flag: "wx", mode: 0o600 });
  console.log(`Created ${fileURLToPath(target)} with independent local credentials.`);
}
