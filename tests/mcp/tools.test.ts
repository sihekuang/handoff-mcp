// tests/mcp/tools.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { registerHandoffTools } from "@/lib/mcp/tools";
import type { Actor } from "@/lib/auth/types";
import type { Pool } from "pg";

type Captured = { name: string; description: string; inputShape: any; handler: (input: any) => Promise<any> };

function makeServer() {
  const tools: Captured[] = [];
  const resources: { name: string; uri: string }[] = [];
  const prompts: { name: string }[] = [];
  return {
    tools,
    tool(name: string, description: string, inputShape: any, handler: any) {
      tools.push({ name, description, inputShape, handler });
    },
    resource(name: string, uri: string) { resources.push({ name, uri }); },
    prompt(name: string) { prompts.push({ name }); },
  };
}

describe("MCP handoff tools", () => {
  let pool: Pool;
  let actor: Actor;

  beforeAll(async () => {
    const out = await freshDb();
    pool = out.pool;
    // Use the dev_user that the migration seeds — no extra seedUser needed.
    actor = { kind: "user", userId: "dev_user" };
  });
  afterAll(async () => { await pool?.end(); });

  it("registers all six tools with descriptions", () => {
    const server = makeServer();
    registerHandoffTools(server as any, actor);
    expect(server.tools.map((t) => t.name).sort()).toEqual([
      "claim_handoff", "create_handoff", "get_handoff",
      "list_handoffs", "release_handoff", "update_handoff",
    ]);
    for (const t of server.tools) {
      expect(t.description.length, `${t.name} needs a description`).toBeGreaterThan(20);
    }
  });

  it("create → list → get → claim → release roundtrip", async () => {
    const server = makeServer();
    registerHandoffTools(server as any, actor);
    const byName = Object.fromEntries(server.tools.map((t) => [t.name, t]));

    const created = await byName.create_handoff.handler({ title: "T", body: "B" });
    expect(created.isError).toBeUndefined();
    const createdHandoff = JSON.parse(created.content[0].text);
    expect(createdHandoff.id).toMatch(/^h_[0-9a-z]{10}$/);

    const listed = await byName.list_handoffs.handler({ status: "open", claimed: false, limit: 10 });
    const listPage = JSON.parse(listed.content[0].text);
    expect(listPage.items.find((i: any) => i.id === createdHandoff.id)).toBeTruthy();

    const got = await byName.get_handoff.handler({ id: createdHandoff.id });
    expect(JSON.parse(got.content[0].text).body).toBe("B");

    const claimed = await byName.claim_handoff.handler({ id: createdHandoff.id, agent: "test-agent" });
    expect(JSON.parse(claimed.content[0].text).claimedBy).toBe("test-agent");

    const released = await byName.release_handoff.handler({ id: createdHandoff.id });
    expect(JSON.parse(released.content[0].text).claimedBy).toBeNull();
  });

  it("create_handoff returns isError on validation failure (empty body)", async () => {
    const server = makeServer();
    registerHandoffTools(server as any, actor);
    const byName = Object.fromEntries(server.tools.map((t) => [t.name, t]));
    const res = await byName.create_handoff.handler({ title: "x", body: "" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/validation/);
  });
});
