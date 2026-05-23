"use client";
// NOTE: `createAuthClient` lives in "better-auth/react" (not "better-auth/react").
// `magicLinkClient` is exported from "better-auth/client/plugins".
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [magicLinkClient()],
});
