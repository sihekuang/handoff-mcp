import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { mcp } from "better-auth/plugins";
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
        console.log(`[magic-link] ${email} -> ${url}`);
      },
    }),
    mcp({
      loginPage: "/login",
      resource: process.env.BETTER_AUTH_URL!,
      oidcConfig: {
        loginPage: "/login",
        allowDynamicClientRegistration: true,
        scopes: [
          "openid",
          "profile",
          "email",
          "handoffs:read",
          "handoffs:write",
        ],
        defaultScope: "handoffs:read handoffs:write",
      },
    }),
  ],
});

export type Auth = typeof auth;
