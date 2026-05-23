// components/status-badge.tsx
import { Badge } from "@/components/ui/badge";

const colors: Record<string, string> = {
  open:         "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_progress:  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done:         "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge className={colors[status] ?? ""}>{status}</Badge>;
}
