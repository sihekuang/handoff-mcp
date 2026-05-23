// app/(web)/h/[id]/actions.ts
"use server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { DEV_ACTOR } from "@/lib/auth/dev";
import { revalidatePath } from "next/cache";

export async function setStatus(id: string, status: "open" | "in_progress" | "done") {
  await service.update(db, DEV_ACTOR, { id, patch: { status } });
  revalidatePath(`/h/${id}`);
  revalidatePath("/");
}

export async function release(id: string) {
  await service.release(db, DEV_ACTOR, id);
  revalidatePath(`/h/${id}`);
  revalidatePath("/");
}
