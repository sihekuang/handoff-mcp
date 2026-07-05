# Automatic Port Selection & Local/Remote MCP Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local `handoff` CLI auto-select a free port on every start and let local editors connect via a stdio bridge (`handoff mcp`) that discovers/starts the server, while the deployed server keeps native HTTP transport.

**Architecture:** One Next.js server that always serves MCP over HTTP at `/mcp`. Locally, `bin/handoff` picks a free port, records it in a run-state file, and `handoff mcp` bridges stdin/stdout ↔ `http://localhost:<port>/mcp`. Remotely, clients point HTTP transport at a stable public URL. Pure helpers live in a testable CJS module; the bridge dynamically imports the (ESM) MCP SDK.

**Tech Stack:** Node.js (CommonJS `bin/` scripts, no build step — copied verbatim by `build:standalone`), `@modelcontextprotocol/sdk` ^1.26, Vitest 4, Next.js 16 standalone output.

## Global Constraints

- `bin/` scripts are **CommonJS** (`require`/`module.exports`); they are copied as-is into `.next/standalone/bin` and must only `require` Node builtins or sibling `bin/*.js` files at load time. The ESM MCP SDK may only be reached via dynamic `import()` inside an async function.
- **Never write to stdout in the `handoff mcp` path** — stdout is the MCP JSON-RPC channel. All diagnostics there go to stderr or the log file.
- Explicit `PORT` env always wins (hosts/tests pin it); only auto-pick when `PORT` is unset.
- Keep `HOSTNAME=127.0.0.1` for the local server.
- Preserve existing env defaults: `BETTER_AUTH_SECRET` fallback `"handoff-mcp-local-dev-secret"`, `BETTER_AUTH_URL` derived from the chosen port.
- MCP endpoint path is `/mcp` (served by `app/[transport]/route.ts`). Tool registration API is `server.tool(name, description, zodShape, handler)` returning `{ content: [{ type: "text", text }] }` (see `lib/mcp/tools.ts`).
- CLI unit tests must not pay the Postgres testcontainer cost; they set `process.env.HANDOFF_NO_DB = "1"` and `tests/setup.ts` skips the container when it is set.

---

### Task 1: Port/state helper module

Pure, dependency-free helpers used by every other task. Node builtins only, so vitest can import them without triggering the DB.

**Files:**
- Create: `bin/handoff-lib.js`
- Modify: `tests/setup.ts` (skip testcontainer when `HANDOFF_NO_DB` set)
- Test: `tests/cli/handoff-lib.test.ts`

**Interfaces:**
- Produces:
  - `findFreePort(): Promise<number>` — an OS-assigned free TCP port on 127.0.0.1.
  - `waitForPort(port: number, host?: string, timeoutMs?: number, intervalMs?: number): Promise<boolean>` — resolves true once something accepts on the port, false on timeout.
  - `readState(dir: string): { pid: number, port: number|null, startedAt?: string } | null` — reads `handoff.json`, falling back to legacy `handoff.pid` as `{pid, port:null}`.
  - `writeState(dir: string, state: object): void` — writes `handoff.json`.
  - `clearState(dir: string): void` — removes `handoff.json` and legacy `handoff.pid`.
  - `getLiveState(dir: string): state|null` — `readState` + liveness check (`process.kill(pid,0)`), clearing stale files.
  - `resolveUrls(port: number): { port, baseUrl, mcpUrl }` — `baseUrl=http://localhost:<port>`, `mcpUrl=<baseUrl>/mcp`.
  - `acquireStartLock(dir: string, staleMs?: number): boolean` / `releaseStartLock(dir: string): void` — atomic single-starter lock via `handoff.start.lock`, self-healing if stale.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/handoff-lib.test.ts`:

```ts
process.env.HANDOFF_NO_DB = "1"; // must be set before setup.ts beforeAll runs

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import {
  findFreePort, waitForPort, readState, writeState, clearState,
  getLiveState, resolveUrls, acquireStartLock, releaseStartLock,
} from "@/bin/handoff-lib.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "handoff-cli-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("findFreePort", () => {
  it("returns a bindable port number", async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });
});

describe("state file", () => {
  it("round-trips state", () => {
    writeState(dir, { pid: 4242, port: 51000, startedAt: "t" });
    expect(readState(dir)).toEqual({ pid: 4242, port: 51000, startedAt: "t" });
  });

  it("falls back to legacy handoff.pid as port:null", () => {
    writeFileSync(join(dir, "handoff.pid"), "777\n");
    expect(readState(dir)).toEqual({ pid: 777, port: null });
  });

  it("getLiveState returns null and clears state for a dead pid", () => {
    writeState(dir, { pid: 999999, port: 51000 });
    expect(getLiveState(dir)).toBeNull();
    expect(existsSync(join(dir, "handoff.json"))).toBe(false);
  });

  it("getLiveState returns state for a live pid", () => {
    writeState(dir, { pid: process.pid, port: 51000 });
    expect(getLiveState(dir)?.port).toBe(51000);
  });

  it("clearState removes json and legacy pid", () => {
    writeState(dir, { pid: 1, port: 2 });
    writeFileSync(join(dir, "handoff.pid"), "1");
    clearState(dir);
    expect(existsSync(join(dir, "handoff.json"))).toBe(false);
    expect(existsSync(join(dir, "handoff.pid"))).toBe(false);
  });
});

describe("resolveUrls", () => {
  it("builds base and mcp urls", () => {
    expect(resolveUrls(51000)).toEqual({
      port: 51000, baseUrl: "http://localhost:51000", mcpUrl: "http://localhost:51000/mcp",
    });
  });
});

describe("start lock", () => {
  it("grants once and blocks a second acquire until released", () => {
    expect(acquireStartLock(dir)).toBe(true);
    expect(acquireStartLock(dir)).toBe(false);
    releaseStartLock(dir);
    expect(acquireStartLock(dir)).toBe(true);
  });
});

describe("waitForPort", () => {
  it("resolves true when a server is listening", async () => {
    const port = await findFreePort();
    const { createServer } = await import("node:net");
    const srv = createServer().listen(port, "127.0.0.1");
    try { expect(await waitForPort(port, "127.0.0.1", 2000)).toBe(true); }
    finally { srv.close(); }
  });

  it("resolves false when nothing listens", async () => {
    const port = await findFreePort();
    expect(await waitForPort(port, "127.0.0.1", 400, 100)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/cli/handoff-lib.test.ts`
Expected: FAIL — cannot resolve `@/bin/handoff-lib.js` (module does not exist yet).

- [ ] **Step 3: Add the testcontainer skip guard**

Modify `tests/setup.ts` — wrap the hook bodies so DB-free tests skip the container:

```ts
beforeAll(async () => {
  if (process.env.HANDOFF_NO_DB) return;
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("handoff_test")
    .withUsername("test")
    .withPassword("test")
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
});

afterAll(async () => {
  if (process.env.HANDOFF_NO_DB) return;
  await container?.stop();
});
```

- [ ] **Step 4: Implement the helper module**

Create `bin/handoff-lib.js`:

```js
"use strict";
const net = require("node:net");
const {
  readFileSync, writeFileSync, existsSync, unlinkSync,
  openSync, closeSync, statSync,
} = require("node:fs");
const { join } = require("node:path");

const STATE = "handoff.json";
const LEGACY = "handoff.pid";
const LOCK = "handoff.start.lock";

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 8000, intervalMs = 150) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      const sock = net.connect(port, host);
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

function readState(dir) {
  const f = join(dir, STATE);
  if (existsSync(f)) {
    try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; }
  }
  const lf = join(dir, LEGACY);
  if (existsSync(lf)) {
    const pid = parseInt(readFileSync(lf, "utf8").trim(), 10);
    if (!Number.isNaN(pid)) return { pid, port: null };
  }
  return null;
}

function writeState(dir, state) {
  writeFileSync(join(dir, STATE), JSON.stringify(state));
}

function clearState(dir) {
  for (const name of [STATE, LEGACY]) {
    try { if (existsSync(join(dir, name))) unlinkSync(join(dir, name)); } catch {}
  }
}

function getLiveState(dir) {
  const s = readState(dir);
  if (!s || !s.pid) return null;
  try { process.kill(s.pid, 0); return s; }
  catch { clearState(dir); return null; }
}

function resolveUrls(port) {
  const baseUrl = `http://localhost:${port}`;
  return { port, baseUrl, mcpUrl: `${baseUrl}/mcp` };
}

function acquireStartLock(dir, staleMs = 15000) {
  const p = join(dir, LOCK);
  try {
    const fd = openSync(p, "wx");
    writeFileSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    try {
      if (Date.now() - statSync(p).mtimeMs > staleMs) {
        unlinkSync(p);
        return acquireStartLock(dir, staleMs);
      }
    } catch {}
    return false;
  }
}

function releaseStartLock(dir) {
  try { unlinkSync(join(dir, LOCK)); } catch {}
}

module.exports = {
  findFreePort, waitForPort, readState, writeState, clearState,
  getLiveState, resolveUrls, acquireStartLock, releaseStartLock,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run tests/cli/handoff-lib.test.ts`
Expected: PASS (all cases). No Postgres container should start (watch for absence of testcontainer log lines).

- [ ] **Step 6: Commit**

```bash
git add bin/handoff-lib.js tests/cli/handoff-lib.test.ts tests/setup.ts
git commit -m "feat: add port/state helpers for handoff CLI"
```

---

### Task 2: Auto-port startup + state file + discovery commands

Rewrite `bin/handoff` to use the helpers: auto-pick a port in `start`, persist `{pid,port}`, report the port in `status`, and add a `url` command.

**Files:**
- Modify: `bin/handoff` (full rewrite of command bodies; keep the shebang)
- Create: `tests/cli/fixtures/fake-server.js`
- Test: `tests/cli/handoff-cli.test.ts`

**Interfaces:**
- Consumes: all exports from `bin/handoff-lib.js` (Task 1).
- Produces (CLI contract, relied on by Task 3 and the plugin config):
  - `handoff start` → auto-picks a free port (unless `PORT` set), writes `handoff.json`, waits for readiness, prints URL/MCP/Logs.
  - `handoff stop` → SIGTERMs the pid, clears state.
  - `handoff status` → prints pid + port.
  - `handoff url [--json]` → prints `http://localhost:<port>/mcp` (human) or `{port,baseUrl,mcpUrl}` (json); non-zero exit if not running.
  - Env overrides: `PORT` (pin port), `HANDOFF_SERVER_JS` (path to server entry, for tests), `HANDOFF_DATA_DIR`.
  - Exported for reuse by Task 3: `startServer({quiet})`, `ensureServer()`, plus the resolved `DATA_DIR`, `LOG_FILE`, `SERVER_JS`. Guard the CLI dispatch with `if (require.main === module)`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/cli/fixtures/fake-server.js`:

```js
// Minimal stand-in for the Next standalone server: binds PORT and answers 200.
const http = require("node:http");
const port = Number(process.env.PORT);
http.createServer((_req, res) => { res.writeHead(200); res.end("ok"); })
  .listen(port, "127.0.0.1");
```

Create `tests/cli/handoff-cli.test.ts`:

```ts
process.env.HANDOFF_NO_DB = "1";

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readState } from "@/bin/handoff-lib.js";

const BIN = resolve("bin/handoff");
const FAKE = resolve("tests/cli/fixtures/fake-server.js");
let root: string;

function run(args: string[], env: Record<string, string> = {}) {
  return execFileSync("node", [BIN, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      HANDOFF_DATA_DIR: join(root, "data"),
      HANDOFF_SERVER_JS: FAKE,
      PORT: "", // force auto-pick
      ...env,
    },
  });
}

afterEach(() => {
  try { run(["stop"]); } catch {}
  if (root) rmSync(root, { recursive: true, force: true });
});

describe("handoff CLI", () => {
  it("auto-picks a port, records state, and serves; url --json reports it; stop clears state", () => {
    root = mkdtempSync(join(tmpdir(), "handoff-cli-int-"));

    const startOut = run(["start"]);
    expect(startOut).toMatch(/handoff-mcp started/);

    const state = readState(root)!;
    expect(state.port).toBeGreaterThan(0);

    const json = JSON.parse(run(["url", "--json"]));
    expect(json.port).toBe(state.port);
    expect(json.mcpUrl).toBe(`http://localhost:${state.port}/mcp`);

    // the fake server should be reachable
    const status = run(["status"]);
    expect(status).toMatch(new RegExp(`port ${state.port}`));

    run(["stop"]);
    expect(existsSync(join(root, "handoff.json"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/cli/handoff-cli.test.ts`
Expected: FAIL — current `bin/handoff` uses a fixed port, has no `url` command, and writes `handoff.pid` not `handoff.json`.

- [ ] **Step 3: Rewrite `bin/handoff`**

Replace the contents of `bin/handoff` (keep the `#!/usr/bin/env node` shebang):

```js
#!/usr/bin/env node
"use strict";

const { spawn, execSync } = require("node:child_process");
const { existsSync, openSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");
const {
  findFreePort, waitForPort, writeState, clearState,
  getLiveState, resolveUrls, acquireStartLock, releaseStartLock,
} = require("./handoff-lib.js");

const DATA_DIR = process.env.HANDOFF_DATA_DIR
  ? join(process.env.HANDOFF_DATA_DIR, "..")
  : join(homedir(), ".local", "share", "handoff-mcp");
require("node:fs").mkdirSync(DATA_DIR, { recursive: true });

const LOG_FILE = join(DATA_DIR, "handoff.log");
const INSTALL_DIR = join(__dirname, "..");
const SERVER_JS = process.env.HANDOFF_SERVER_JS || join(INSTALL_DIR, "server.js");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer({ quiet } = {}) {
  const log = quiet ? () => {} : console.log;
  const existing = getLiveState(DATA_DIR);
  if (existing && existing.port) {
    log(`handoff-mcp is already running (pid ${existing.pid}) on port ${existing.port}`);
    return existing;
  }
  if (!existsSync(SERVER_JS)) {
    throw new Error(
      `Server not found at ${SERVER_JS}. Run 'pnpm build:standalone' first, or reinstall via Homebrew.`,
    );
  }
  const port = process.env.PORT ? Number(process.env.PORT) : await findFreePort();
  const out = openSync(LOG_FILE, "a");
  const child = spawn("node", [SERVER_JS], {
    detached: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      HANDOFF_DATA_DIR: join(DATA_DIR, "data"),
      HANDOFF_INSTALL_DIR: INSTALL_DIR,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "handoff-mcp-local-dev-secret",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
    },
  });
  child.unref();

  const up = await waitForPort(port);
  if (!up) {
    try { process.kill(child.pid); } catch {}
    throw new Error(`Server did not become reachable on port ${port}; see ${LOG_FILE}`);
  }
  const state = { pid: child.pid, port, startedAt: new Date().toISOString() };
  writeState(DATA_DIR, state);
  return state;
}

// Ensure a server is running without printing to stdout (safe for `mcp` mode).
async function ensureServer() {
  let s = getLiveState(DATA_DIR);
  if (s && s.port) return s;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (acquireStartLock(DATA_DIR)) {
      try {
        s = getLiveState(DATA_DIR);
        if (s && s.port) return s;
        return await startServer({ quiet: true });
      } finally { releaseStartLock(DATA_DIR); }
    }
    await delay(200);
    s = getLiveState(DATA_DIR);
    if (s && s.port) return s;
  }
  throw new Error("Timed out waiting for the handoff server to start");
}

async function start() {
  const s = await startServer({});
  const { baseUrl, mcpUrl } = resolveUrls(s.port);
  console.log(`handoff-mcp started (pid ${s.pid})`);
  console.log(`  URL:  ${baseUrl}`);
  console.log(`  MCP:  ${mcpUrl}`);
  console.log(`  Logs: ${LOG_FILE}`);
}

function stop() {
  const s = getLiveState(DATA_DIR);
  if (!s) { console.log("handoff-mcp is not running."); return; }
  try { process.kill(s.pid, "SIGTERM"); } catch {}
  clearState(DATA_DIR);
  console.log(`handoff-mcp stopped (pid ${s.pid}).`);
}

function status() {
  const s = getLiveState(DATA_DIR);
  if (s) {
    console.log(`handoff-mcp is running (pid ${s.pid}) on port ${s.port ?? "unknown (restart to refresh)"}`);
  } else {
    console.log("handoff-mcp is not running.");
  }
}

function url(json) {
  const s = getLiveState(DATA_DIR);
  if (!s || !s.port) {
    console.error("handoff-mcp is not running (no port to report). Run 'handoff start' or 'handoff mcp'.");
    process.exit(1);
  }
  const urls = resolveUrls(s.port);
  console.log(json ? JSON.stringify(urls) : urls.mcpUrl);
}

async function mcp() {
  // stdout is reserved for MCP JSON-RPC — never console.log here.
  const { runBridge } = require("./handoff-bridge.js");
  const target = process.env.HANDOFF_MCP_URL || resolveUrls((await ensureServer()).port).mcpUrl;
  await runBridge(target);
}

function logs() {
  if (existsSync(LOG_FILE)) execSync(`tail -f "${LOG_FILE}"`, { stdio: "inherit" });
  else console.log("No log file found.");
}

function help() {
  console.log(`handoff-mcp — AI agent handoff server

Usage:
  handoff start    Start the server in the background (auto-selects a free port)
  handoff stop     Stop the server
  handoff status   Check if the server is running and on which port
  handoff url      Print the MCP endpoint URL (--json for machine output)
  handoff mcp      Bridge stdio to the local server (used by MCP clients)
  handoff logs     Tail the server logs

Environment:
  PORT             Pin the server port (default: auto-selected free port)
  HANDOFF_DATA_DIR Data directory (default: ~/.local/share/handoff-mcp)
  HANDOFF_MCP_URL  For 'mcp': bridge to this URL instead of auto-starting locally
`);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "start": await start(); break;
    case "stop": stop(); break;
    case "status": status(); break;
    case "url": url(process.argv.includes("--json")); break;
    case "mcp": await mcp(); break;
    case "logs": logs(); break;
    default: help(); break;
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}

module.exports = { startServer, ensureServer, DATA_DIR, LOG_FILE, SERVER_JS };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/cli/handoff-cli.test.ts`
Expected: PASS — start prints "handoff-mcp started", state has a port, `url --json` matches, stop clears state.

- [ ] **Step 5: Commit**

```bash
git add bin/handoff tests/cli/handoff-cli.test.ts tests/cli/fixtures/fake-server.js
git commit -m "feat: auto-select port and add url/state to handoff CLI"
```

---

### Task 3: stdio↔HTTP bridge + `handoff mcp`

Add the transport-level passthrough that the local plugin config invokes. It bridges the editor's stdio to the local server's HTTP `/mcp`.

**Files:**
- Create: `bin/handoff-bridge.js`
- Test: `tests/cli/handoff-bridge.test.ts`

**Interfaces:**
- Consumes: `HANDOFF_MCP_URL` / `ensureServer()` wiring from Task 2's `mcp()` command.
- Produces: `runBridge(mcpUrl: string): Promise<void>` — connects a `StdioServerTransport` to a `StreamableHTTPClientTransport` and forwards JSON-RPC messages both ways until either side closes.

- [ ] **Step 1: Write the failing integration test**

Create `tests/cli/handoff-bridge.test.ts`. It stands up an in-process **stateless** Streamable-HTTP MCP server (SDK), then connects an SDK `Client` through the real `handoff mcp` subprocess (pointed at that server via `HANDOFF_MCP_URL`) and calls a tool.

```ts
process.env.HANDOFF_NO_DB = "1";

import { describe, it, expect } from "vitest";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Stateless MCP HTTP server: new server+transport per request (SDK-recommended pattern).
function buildMcpHttpServer(): Promise<{ server: Server; port: number }> {
  const httpServer = createServer(async (req, res) => {
    const mcp = new McpServer({ name: "test", version: "0.0.0" });
    mcp.tool("ping", "returns pong", {}, async () => ({
      content: [{ type: "text", text: "pong" }],
    }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); mcp.close(); });
    await mcp.connect(transport);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
    });
  });
  return new Promise((resolveP) => {
    httpServer.listen(0, "127.0.0.1", () => {
      resolveP({ server: httpServer, port: (httpServer.address() as any).port });
    });
  });
}

describe("handoff mcp bridge", () => {
  it("bridges stdio to an HTTP MCP server end-to-end", async () => {
    const { server, port } = await buildMcpHttpServer();
    const transport = new StdioClientTransport({
      command: "node",
      args: [resolve("bin/handoff"), "mcp"],
      env: {
        ...process.env,
        HANDOFF_MCP_URL: `http://127.0.0.1:${port}/mcp`,
        HANDOFF_NO_DB: "1",
      } as Record<string, string>,
    });
    const client = new Client({ name: "test-client", version: "0.0.0" });
    try {
      await client.connect(transport);
      const result: any = await client.callTool({ name: "ping", arguments: {} });
      expect(JSON.stringify(result)).toContain("pong");
    } finally {
      await client.close();
      server.close();
    }
  }, 30_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/cli/handoff-bridge.test.ts`
Expected: FAIL — `bin/handoff-bridge.js` does not exist, so `handoff mcp` throws on `require("./handoff-bridge.js")`.

- [ ] **Step 3: Implement the bridge**

Create `bin/handoff-bridge.js`:

```js
"use strict";

// Transport-level passthrough: editor <-stdio-> this process <-http-> local server.
// stdout is the MCP channel; diagnostics go to stderr only.
async function runBridge(mcpUrl) {
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );

  const stdio = new StdioServerTransport();
  const http = new StreamableHTTPClientTransport(new URL(mcpUrl));

  const warn = (label, e) =>
    process.stderr.write(`[handoff mcp] ${label}: ${(e && e.message) || e}\n`);

  stdio.onmessage = (m) => { http.send(m).catch((e) => warn("upstream send", e)); };
  http.onmessage = (m) => { stdio.send(m).catch((e) => warn("downstream send", e)); };

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    Promise.allSettled([stdio.close(), http.close()]).then(() => process.exit(0));
  };
  stdio.onclose = shutdown;
  http.onclose = shutdown;
  stdio.onerror = (e) => warn("stdio", e);
  http.onerror = (e) => warn("http", e);

  await http.start();   // Transport contract: start() before send()
  await stdio.start();
}

module.exports = { runBridge };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/cli/handoff-bridge.test.ts`
Expected: PASS — the `ping` tool result travels editor→bridge→HTTP server→back, containing "pong".

Note: if the installed SDK's stateless `StreamableHTTPServerTransport` wiring differs, cross-check against `app/[transport]/route.ts` and the SDK's `server/streamableHttp.d.ts`; the `server.tool(name, desc, shape, handler)` call already matches `lib/mcp/tools.ts`.

- [ ] **Step 5: Commit**

```bash
git add bin/handoff-bridge.js tests/cli/handoff-bridge.test.ts
git commit -m "feat: add stdio-to-http MCP bridge (handoff mcp)"
```

---

### Task 4: Switch local plugin config to stdio + document both transports

Point the plugin's MCP config at the stdio bridge, verify the standalone build ships the SDK, and document the local + remote paths.

**Files:**
- Modify: `plugins/handoff-mcp/.mcp.json`
- Modify: `README.md`
- Verify: `.next/standalone/node_modules/@modelcontextprotocol/sdk` presence after `build:standalone`

**Interfaces:**
- Consumes: the `handoff mcp` command (Task 3).

- [ ] **Step 1: Switch the local plugin MCP config to stdio**

Replace `plugins/handoff-mcp/.mcp.json`:

```json
{
  "mcpServers": {
    "handoff": {
      "command": "handoff",
      "args": ["mcp"]
    }
  }
}
```

(Consumed by both `plugins/handoff-mcp/.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, which already reference `./.mcp.json`.)

- [ ] **Step 2: Verify the standalone build traces the SDK**

Run:
```bash
pnpm build:standalone
test -d .next/standalone/node_modules/@modelcontextprotocol/sdk && echo "SDK TRACED" || echo "SDK MISSING"
```
Expected: `SDK TRACED`.
If `SDK MISSING`, append to the `build:standalone` script in `package.json` a copy step:
`cp -r node_modules/@modelcontextprotocol .next/standalone/node_modules/` (after the existing copies), then re-run and confirm.

- [ ] **Step 3: Smoke-test the installed path**

Run:
```bash
node bin/handoff start
node bin/handoff url --json
node bin/handoff status
node bin/handoff stop
```
Expected: start prints an auto-selected port; `url --json` reports the same port; status shows it; stop clears it. (These run against the real built `server.js`.)

- [ ] **Step 4: Update README**

In `README.md`:
- Replace hardcoded `http://localhost:3007/mcp` / `:3000/mcp` MCP references with: "the server auto-selects a free port; run `handoff url` to print the MCP endpoint, or `handoff status` to see the port."
- Add a **Local (plugin)** subsection: the plugin connects via `handoff mcp` (stdio) — no port config needed; it auto-starts the server on first use.
- Add a **Remote / hosted** subsection: `claude mcp add --transport http handoff https://<your-host>/mcp`, and a warning that a public deployment must enable auth (better-auth) first — the server is unauthenticated at MVP (see `docs/decisions.md` and the spec's "Remote deployment prerequisite").
- Keep `pnpm dev` docs (still port 3000 for app development).

- [ ] **Step 5: Full test + lint gate**

Run: `pnpm test && pnpm lint`
Expected: all tests pass; lint clean.

- [ ] **Step 6: Commit**

```bash
git add plugins/handoff-mcp/.mcp.json README.md package.json
git commit -m "feat: connect local plugin via stdio bridge; document local+remote transports"
```

---

## Self-Review

**1. Spec coverage:**
- Auto port selection → Task 2 (`startServer` + `findFreePort`, `PORT` override). ✓
- Run-state file replacing PID + legacy back-compat → Task 1 (`readState`/`getLiveState`) + Task 2 (`start`/`stop`). ✓
- Discovery commands (`url`/`status`/`--json`) + help-text fix → Task 2. ✓
- `handoff mcp` stdio bridge with auto-start + start-lock → Task 2 (`ensureServer`) + Task 3 (`runBridge`). ✓
- Two client configs (local stdio / remote HTTP) → Task 4. ✓
- Auth gate documented → Task 4 Step 4. ✓
- ESM/CJS risk (dynamic import, standalone tracing) → Global Constraints + Task 4 Step 2. ✓
- Codex loader parity → Task 4 Step 1 note (shared `.mcp.json`). ✓
- Testing (unit, integration start→url→http, bridge handshake, concurrency) → Tasks 1–3. Concurrency is exercised implicitly by the start-lock unit test; a dedicated dual-`handoff mcp` test is optional and omitted to keep the suite fast (noted here rather than silently dropped).

**2. Placeholder scan:** No TBD/TODO; `<your-host>` in README is a genuine user-supplied value, not an unresolved plan detail. ✓

**3. Type consistency:** `findFreePort`, `waitForPort`, `readState`, `writeState`, `clearState`, `getLiveState`, `resolveUrls`, `acquireStartLock`, `releaseStartLock`, `startServer`, `ensureServer`, `runBridge` are named identically across their defining task and every consumer. State shape `{pid, port, startedAt}` is consistent. `resolveUrls` returns `{port, baseUrl, mcpUrl}` everywhere. ✓
