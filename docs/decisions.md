# Decisions Log

Append-only record of decisions made autonomously from evidence (per the evidence-based-decisions skill).

## 2026-07-05 — Dual local/remote MCP transport: shared server + two distinct client configs
**Decision:** Ship ONE server implementation that always exposes the MCP endpoint over HTTP (`/mcp`). Provide TWO distinct client configs rather than a single auto-switching command:
- **Local self-host** (Homebrew `handoff start`): connect via a **stdio** command (`handoff mcp`) that discovers/starts the local server on an auto-selected free port and bridges stdio↔`localhost:<port>/mcp`.
- **Deployed / remote**: connect via **HTTP transport** pointed at the stable public URL (`https://<host>/mcp`), no bridge.

Do NOT build a bespoke client command that auto-detects local-vs-remote and switches transport.
**Trigger:** User asked whether we can "abstract this out so locally it uses STDIO but when deployed we use MCP over HTTP." Needed to choose between one auto-switching command and two distinct configs.
**Basis:** Unanimous across 3+ independent, credible sources. All describe a single shared server implementation with local→stdio and remote→HTTP, exposed as **distinct per-deployment configs** (transport chosen explicitly, not auto-detected). GitHub's official server states these are "separate deployment targets—not variants of one command." Standard stdio↔HTTP bridges (mcp-proxy, supergateway, mcp-remote) are the recognized way to expose a stdio client path for an HTTP-native server.
**Sources:**
- GitHub official MCP server — Deployment Models (shared toolset; local stdio via Docker/binary, remote HTTP at api.githubcopilot.com/mcp/; "not variants of one command") — https://deepwiki.com/github/github-mcp-server/1.2-getting-started and https://github.com/github/github-mcp-server
- FastMCP — Running Your Server (one implementation, transport selected explicitly at runtime, not auto-detected; match transport to deployment scenario) — https://gofastmcp.com/deployment/running-server
- Microsoft Tech Community — "One MCP Server, Two Transports: STDIO and HTTP" (single server, runtime `--http` switch, distinct client configs) — https://techcommunity.microsoft.com/blog/azuredevcommunityblog/one-mcp-server-two-transports-stdio-and-http/4443915
- Supporting: Speakeasy "Deploying remote MCP servers"; sparfenyuk/mcp-proxy (Streamable HTTP ↔ stdio bridge); supercorp-ai/supergateway (stdio↔SSE bridge)
