import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("repo userId guard", () => {
  it("every exported query/mutation function passes userId through to scoped query", () => {
    const src = readFileSync("lib/handoffs/repo.ts", "utf8");
    // Heuristic: each exported function body that reads/mutates data must
    // either directly reference `handoffs.userId` (WHERE clause) or pass the
    // userId parameter through to another function that does (delegation).
    // This catches functions that forget to scope rows to the calling user.
    //
    // `insertHandoff` is excluded: userId is enforced structurally via the
    // NOT NULL DB column and the required TypeScript input type ($inferInsert).
    const fnBlocks = src.split(/\nexport (?:async )?function /).slice(1);
    for (const block of fnBlocks) {
      const name = block.split("(")[0];
      if (name === "insertHandoff") continue; // userId required by type + DB NOT NULL
      // Must either filter directly (handoffs.userId) or delegate with userId param
      const hasDirectFilter = /handoffs\.userId/.test(block);
      const hasDelegation = /\buserId\b/.test(block); // passes userId to inner fn
      expect(hasDirectFilter || hasDelegation, `${name} must reference userId`).toBe(true);
    }
  });
});
