// components/status-badge.tsx
import { Badge } from "@/components/ui/badge";

const colors: Record<string, string> = {
  open:         "bg-[var(--color-status-open)]/15 text-[var(--color-status-open)]",
  in_progress:  "bg-[var(--color-status-in-progress)]/15 text-[var(--color-status-in-progress)]",
  done:         "bg-[var(--color-status-done)]/15 text-[var(--color-status-done)]",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge className={colors[status] ?? ""}>{status}</Badge>;
}
