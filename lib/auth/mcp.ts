import { auth } from "@/lib/auth/better-auth";
import type { Actor } from "./types";

/**
 * Verifies a Bearer access token issued by Better Auth's MCP/OIDC plugin.
 *
 * Uses `auth.api.getMcpSession` — the MCP plugin endpoint that looks up the
 * access token from the DB and returns the OAuthAccessToken record.
 * OAuthAccessToken.scopes is a space-separated string.
 * clientName falls back to clientId because the OAuthAccessToken record
 * does not carry the application's human-readable name.
 * Task 5.4 can enhance this with a separate oauthApplication lookup if needed.
 */
export async function verifyAccessToken(token: string): Promise<{
  actor: Actor;
  scopes: string[];
} | null> {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  const result = await auth.api.getMcpSession({ headers });
  if (!result) return null;

  // Check token expiry (getMcpSession does not reject expired tokens itself)
  if (result.accessTokenExpiresAt < new Date()) return null;

  const scopes = result.scopes ? result.scopes.split(" ").filter(Boolean) : [];
  return {
    actor: {
      kind: "agent",
      userId: result.userId,
      clientId: result.clientId,
      // OAuthAccessToken has no clientName field; use clientId as display name.
      // Task 5.4 can resolve the oauthApplication record for a friendlier name.
      clientName: result.clientId,
    },
    scopes,
  };
}

/** Pulls Bearer token from Authorization header. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function resolveAgentActor(req: Request): Promise<Actor | null> {
  const token = bearerFrom(req);
  if (!token) return null;
  const result = await verifyAccessToken(token);
  return result?.actor ?? null;
}
