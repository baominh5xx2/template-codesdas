import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import pg from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = parse(readFileSync(new URL("../.env.docker", import.meta.url)));
const appUrl = `http://127.0.0.1:${env.APP_PORT || 3100}`;
const mcpUrl = `http://127.0.0.1:${env.MCP_PORT || 18080}`;

async function fetchLocal(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
}

async function checkDatabase() {
  const settings = {
    host: "127.0.0.1", port: Number(env.POSTGRES_PORT || 55432),
    database: "starter", connectionTimeoutMillis: 5_000,
  };
  const app = new pg.Client({ ...settings, user: "starter_app", password: env.APP_DB_PASSWORD });
  const mcp = new pg.Client({ ...settings, user: "starter_mcp", password: env.MCP_DB_PASSWORD });
  try {
    await app.connect();
    await mcp.connect();
    assert.equal((await app.query("SELECT id FROM app.setup_probe WHERE id = 1")).rowCount, 1);
    await app.query("BEGIN");
    assert.equal((await app.query("UPDATE analytics.setup_probe SET note = note WHERE id = 1")).rowCount, 1);
    await app.query("ROLLBACK");
    assert.equal((await mcp.query("SELECT id FROM analytics.setup_probe WHERE id = 1")).rowCount, 1);
    // Prove grants protect the data even if a client overrides the read-only default.
    await mcp.query("SET default_transaction_read_only = off");
    for (const sql of [
      "UPDATE analytics.setup_probe SET note = note WHERE id = 1",
      "SELECT * FROM app.setup_probe",
    ]) {
      await assert.rejects(mcp.query(sql), error => error.code === "42501");
    }
    console.log("PASS: app role can read/write; MCP role reads analytics and cannot write or read app-private data.");
  } finally {
    await Promise.allSettled([app.end(), mcp.end()]);
  }
}

async function checkMcp() {
  const health = await fetchLocal(`${mcpUrl}/health`);
  assert.equal(health.status, 200);
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${env.MCP_AUTH_TOKEN}`,
  };
  let requestId = 0;
  async function rpc(method, params) {
    const response = await fetchLocal(`${mcpUrl}/mcp/v1`, {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    });
    assert.equal(response.status, 200, `MCP ${method} HTTP status`);
    const body = await response.json();
    assert.equal(body.error, undefined, `MCP ${method} protocol error`);
    const session = response.headers.get("mcp-session-id");
    if (session) headers["Mcp-Session-Id"] = session;
    return body.result;
  }
  const initialized = await rpc("initialize", {
    protocolVersion: "2025-06-18", capabilities: {},
    clientInfo: { name: "starter-infrastructure-check", version: "1.0.0" },
  });
  assert.equal(initialized.serverInfo.name, "pgedge-postgres-mcp");
  headers["MCP-Protocol-Version"] = initialized.protocolVersion;
  const notified = await fetchLocal(`${mcpUrl}/mcp/v1`, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  assert.ok(notified.ok, "MCP initialization notification accepted");
  const { tools } = await rpc("tools/list", {});
  const names = tools.map(tool => tool.name);
  for (const required of ["query_database", "get_schema_info", "count_rows"]) {
    assert.ok(names.includes(required), `${required} available`);
  }
  for (const disabled of ["generate_embedding", "similarity_search", "search_knowledgebase", "list_database_connections", "select_database_connection"]) {
    assert.ok(!names.includes(disabled), `${disabled} disabled`);
  }
  const read = await rpc("tools/call", {
    name: "query_database",
    arguments: { query: "SELECT id, note, synthetic FROM analytics.setup_probe WHERE id = 1", limit: 1 },
  });
  assert.ok(!read.isError, "MCP query succeeds");
  assert.ok(JSON.stringify(read).includes("starter infrastructure probe"), "MCP returns synthetic probe");
  for (const query of [
    "UPDATE analytics.setup_probe SET note = note WHERE id = 1",
    "SELECT * FROM app.setup_probe",
  ]) {
    const denied = await rpc("tools/call", { name: "query_database", arguments: { query } });
    assert.equal(denied.isError, true, "MCP rejects writes/private reads");
  }
  for (const authorization of [undefined, "Bearer invalid-starter-test-token"]) {
    const badHeaders = { "content-type": "application/json", accept: "application/json" };
    if (authorization) badHeaders.authorization = authorization;
    const rejected = await fetchLocal(`${mcpUrl}/mcp/v1`, {
      method: "POST", headers: badHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }),
    });
    assert.ok([401, 403].includes(rejected.status), "Missing/invalid MCP token rejected");
  }
  console.log(`PASS: MCP ${initialized.serverInfo.version}, protocol ${initialized.protocolVersion}, authenticated query and failure checks.`);
}

async function checkApp() {
  const health = await fetchLocal(`${appUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const page = await fetchLocal(appUrl);
  assert.equal(page.status, 200);
  const html = await page.text();
  const asset = html.match(/src="([^"\s]*\/_next\/static\/[^"\s]+\.js)"/);
  assert.ok(asset, "Built app exposes static JavaScript");
  assert.equal((await fetchLocal(new URL(asset[1], appUrl))).status, 200);
  if (!env.CHAT_MODEL_BASE_URL || !env.CHAT_MODEL_ID) {
    const readiness = await fetchLocal(`${appUrl}/api/chat/readiness`);
    assert.equal((await readiness.json()).available, false);
    const unavailable = await fetchLocal(`${appUrl}/api/copilotkit/info`);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { code: "chat_unavailable", message: "Chưa kết nối" });
  }
  const networkProbe = spawnSync("docker", [
    "compose", "--project-name", "hackathon-starter-core", "--env-file", ".env.docker",
    "--file", "compose.yaml", "exec", "-T", "app", "node", "-e",
    "const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='db'||u.username!=='starter_app'||process.env.MCP_SERVER_URL!=='http://mcp:8080/mcp/v1')process.exit(1);const s=require('node:net').connect(5432,'db',()=>s.end());s.setTimeout(5000,()=>{s.destroy();process.exit(1)});s.on('error',()=>process.exit(1));",
  ], { cwd: root, encoding: "utf8" });
  assert.equal(networkProbe.status, 0, "App has service DNS, DB access and internal MCP URL");
  console.log("PASS: app page, static asset, health, no-config chat notice and container network.");
}

try {
  await checkDatabase();
  await checkMcp();
  await checkApp();
  console.log("Starter Compose smoke checks passed.");
} catch (error) {
  console.error(`Starter Compose smoke check failed: ${error.message}`);
  process.exitCode = 1;
}
