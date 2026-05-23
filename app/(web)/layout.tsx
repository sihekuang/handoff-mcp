import Link from "next/link";

// AUTH DEFERRED: middleware route-gate goes here once auth is implemented

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] px-6 py-3 flex items-center gap-6">
        <Link href="/" className="font-mono font-semibold">handoff-mcp</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/" className="hover:underline">Handoffs</Link>
        </nav>
        <span className="ml-auto text-xs text-[var(--color-muted)]">auth deferred — dev_user</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
