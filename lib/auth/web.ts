import { auth } from "@/lib/auth/better-auth";
import type { Actor } from "./types";

export async function resolveWebActor(req: Request): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return { kind: "user", userId: session.user.id };
}
