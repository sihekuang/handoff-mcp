import "@/tests/cli/no-db"; // must be first: skips the Postgres testcontainer without leaking the flag

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
