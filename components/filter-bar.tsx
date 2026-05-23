// components/filter-bar.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v); else next.delete(k);
    router.push(`/?${next.toString()}`);
  };
  return (
    <div className="flex gap-2 items-center">
      <Select value={sp.get("status") ?? "any"} onValueChange={(v) => set("status", v === "any" ? undefined : v ?? undefined)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
      <Input
        placeholder="Search…"
        defaultValue={sp.get("q") ?? ""}
        onKeyDown={(e) => { if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value || undefined); }}
        className="max-w-xs"
      />
    </div>
  );
}
