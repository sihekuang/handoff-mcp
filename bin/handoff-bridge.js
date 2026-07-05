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
    process.stderr.write(`[handoff mcp] ${label}: ${(e && e.message) || String(e)}\n`);

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

  // StdioServerTransport only listens for stdin 'data'/'error' — it never
  // surfaces EOF. Watch stdin directly so the bridge self-terminates when the
  // client disconnects (ends stdin), instead of lingering until SIGTERM.
  process.stdin.on("end", shutdown);
  process.stdin.on("close", shutdown);
}

module.exports = { runBridge };
