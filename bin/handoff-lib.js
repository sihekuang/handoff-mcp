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
