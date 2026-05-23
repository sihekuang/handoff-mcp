// lib/auth/dev.ts
//
// Hardcoded development actor used while authentication is deferred.
// When Better Auth's MCP/OAuth flow is wired in (later), this file
// (and the call sites using DEV_ACTOR) get replaced by the real
// actor-resolution path.

import type { Actor } from "./types";

export const DEV_USER_ID = "dev_user";

export const DEV_ACTOR: Actor = {
  kind: "user",
  userId: DEV_USER_ID,
};
