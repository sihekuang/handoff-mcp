import "@/tests/cli/no-db";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
