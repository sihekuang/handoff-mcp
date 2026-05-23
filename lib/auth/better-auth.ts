import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// NOTE: better-auth@1.6.11 does not ship an "oauth-provider" or "oAuthProvider" plugin.
// The general OAuth 2 / OIDC provider is exposed as `oidcProvider` from
// "better-auth/plugins/oidc-provider" (marked @deprecated in favour of the
// forthcoming @better-auth/oauth-provider package, but fully functional in 1.6.11).
// The `mcp` plugin is a thin wrapper around oidcProvider that adds
// MCP-specific discovery endpoints (/.well-known/oauth-authorization-server,
// /.well-known/oauth-protected-resource) and MCP-prefixed routes.
// We use `oidcProvider` directly so we can pass our custom scopes.
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // TODO(Task 2.3): replace with Resend once the email domain is confirmed.
        console.log(`[magic-link] ${email} -> ${url}`);
      },
    }),
    // Adaptation: plan specified `oAuthProvider` (doesn't exist in 1.6.11).
    // Using `oidcProvider` which is the current OAuth 2 / OIDC server plugin.
    // `issuer` is derived automatically from `baseURL`; no explicit field.
    // `supportedScopes` → `scopes` (the actual field name in OIDCOptions).
    // `allowDynamicClientRegistration` is correct (verified in types).
    // `loginPage` is required by OIDCOptions; consent redirect target.
    oidcProvider({
      __skipDeprecationWarning: true,
      allowDynamicClientRegistration: true,
      defaultScope: "handoffs:read handoffs:write",
      scopes: ["openid", "profile", "email", "handoffs:read", "handoffs:write"],
      loginPage: "/login",
    }),
  ],
});

export type Auth = typeof auth;
