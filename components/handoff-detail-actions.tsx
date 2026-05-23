// components/handoff-detail-actions.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setStatus, release } from "@/app/(web)/h/[id]/actions";

export function DetailActions({ id, status, claimedBy }: { id: string; status: string; claimedBy: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <Select defaultValue={status} onValueChange={(v) => setStatus(id, v as any)}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">open</SelectItem>
          <SelectItem value="in_progress">in_progress</SelectItem>
          <SelectItem value="done">done</SelectItem>
        </SelectContent>
      </Select>
      {claimedBy && <Button variant="outline" onClick={() => release(id)}>Release (claimed by {claimedBy})</Button>}
    </div>
  );
}
