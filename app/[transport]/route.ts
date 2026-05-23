// app/[transport]/route.ts
//
// MCP server mounted at /[transport] (e.g. /mcp, /sse).
//
// AUTH DEFERRED: The server runs unauthenticated using the hardcoded DEV_ACTOR.
// When auth lands, wrap `handler` in:
//   withMcpAuth(handler, verifyToken, { required: true })
// and resolve the actor from req.auth.extra.actor.
// See lib/auth/mcp.ts (verifyAccessToken) — already implemented; not invoked yet.
//
// mcp-handler@1.1.0 API notes:
//   - Export name: createMcpHandler (re-exported as alias for createMcpRouteHandler)
//   - Signature: createMcpHandler(initializeServer, serverOptions, config)
//     serverOptions: { serverInfo?: { name, version }, instructions?: string, ... }
//     config: { basePath?, maxDuration?, verboseLogs?, ... }
//   - initializeServer receives McpServer — use server.tool/resource/prompt to register.
//   - instructions is a static field on serverOptions (not per-request).

import { createMcpHandler } from "mcp-handler";
import { registerHandoffTools } from "@/lib/mcp/tools";
import { registerSkillResources } from "@/lib/mcp/resources";
import { DEFAULT_SKILL } from "@/lib/mcp/skill";
import { DEV_ACTOR } from "@/lib/auth/dev";

const handler = createMcpHandler(
  (server) => {
    registerHandoffTools(server, DEV_ACTOR);
    registerSkillResources(server, DEV_ACTOR);
  },
  {
    serverInfo: { name: "handoff-mcp", version: "0.1.0" },
    instructions: DEFAULT_SKILL,
  },
  {
    basePath: "",   // route lives at app/[transport]; /mcp and /sse are auto-derived
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST };
