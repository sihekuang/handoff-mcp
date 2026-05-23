// lib/auth/client.ts
//
// AUTH DEFERRED: this Better Auth React client is built but unused.
// It's the bridge for an eventual /login page (GitHub OAuth + magic-link).
// Once Phase 6's login route is built, app/(web)/login/page.tsx will
// import authClient.signIn.social({ provider: "github" }) and
// authClient.signIn.magicLink({ email }) from here.
//
// Leaving in tree so the auth wire-up is a one-file change.

"use client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [magicLinkClient()],
});
