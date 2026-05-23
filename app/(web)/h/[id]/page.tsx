// app/(web)/h/[id]/page.tsx
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { DEV_ACTOR } from "@/lib/auth/dev";
import { notFound } from "next/navigation";
import { Markdown } from "@/lib/markdown";
import { StatusBadge } from "@/components/status-badge";
import { DetailActions } from "@/components/handoff-detail-actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const handoff = await service.get(db, DEV_ACTOR, id);
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 max-w-6xl mx-auto">
        <article>
          <header className="mb-6">
            <h1 className="text-2xl font-semibold">{handoff.title}</h1>
            {handoff.summary && <p className="text-muted-foreground mt-1">{handoff.summary}</p>}
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={handoff.status} />
              <span className="font-mono text-xs text-muted-foreground">{handoff.id}</span>
            </div>
          </header>
          <Markdown>{handoff.body}</Markdown>
        </article>
        <aside className="space-y-4 text-sm">
          <DetailActions id={handoff.id} status={handoff.status} claimedBy={handoff.claimedBy} />
          <Section title="Project">{handoff.project ?? "—"}</Section>
          <Section title="Tags">{handoff.tags.length ? handoff.tags.join(", ") : "—"}</Section>
          {handoff.metadata?.git && (
            <Section title="Git">
              <div>repo: {handoff.metadata.git.repo ?? "—"}</div>
              <div>branch: {handoff.metadata.git.branch ?? "—"}</div>
              <div>commit: {handoff.metadata.git.commit ?? "—"}</div>
            </Section>
          )}
          {handoff.metadata?.files?.length ? (
            <Section title="Files">
              {handoff.metadata.files.map((f) => (
                <div key={f.path} className="font-mono text-xs">{f.path}</div>
              ))}
            </Section>
          ) : null}
          <Section title="Created">{new Date(handoff.createdAt).toLocaleString()}</Section>
          <Section title="Updated">{new Date(handoff.updatedAt).toLocaleString()}</Section>
        </aside>
      </div>
    );
  } catch (e: any) {
    if (e?.kind === "not_found") notFound();
    throw e;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div>{children}</div>
    </div>
  );
}
