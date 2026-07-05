import "@/tests/cli/no-db"; // must be first: skips the Postgres testcontainer without leaking the flag

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
