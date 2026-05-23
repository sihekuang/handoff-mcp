// app/(web)/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { DEV_ACTOR } from "@/lib/auth/dev";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function HandoffsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = await service.list(db, DEV_ACTOR, {
    status: params.status as any,
    project: params.project,
    tag: params.tag,
    query: params.q,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Handoffs</h1>
        <FilterBar />
      </div>
      {page.items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No handoffs yet. Have an agent call <code>create_handoff</code> via the MCP server at <code>/mcp</code>.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Claimed</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <Link href={`/h/${i.id}`} className="font-medium hover:underline">{i.title}</Link>
                  {i.summary && <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{i.summary}</div>}
                </TableCell>
                <TableCell><StatusBadge status={i.status} /></TableCell>
                <TableCell className="text-sm">{i.project ?? "—"}</TableCell>
                <TableCell className="text-sm">{i.claimedBy ?? "—"}</TableCell>
                <TableCell className="text-sm">{new Date(i.updatedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{i.id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
