"use client";

import { useSessionContext } from "@/components/SessionProvider";

function formatTime(unixSeconds: string | null | undefined): string {
  if (!unixSeconds) return "—";
  const ts = Number(unixSeconds);
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

export default function SessionControls() {
  const { sessionId, hydrated, ready, dbReady, start, end } = useSessionContext();

  if (!ready) {
    return <div className="mb-2 text-xs text-[var(--text-secondary)]/60">Loading session…</div>;
  }

  if (!sessionId) {
    return (
      <button
        type="button"
        onClick={() => void start()}
        className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-1.5 text-xs font-medium hover:border-[var(--accent-blue)]/50 hover:text-[var(--accent-blue)]"
      >
        ▶ Start session
      </button>
    );
  }

  const turnCount = hydrated?.messages?.length ?? 0;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${
          dbReady
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
        }`}
        title={dbReady ? "Persisted to MongoDB" : "DB unreachable — session kept in browser only"}
      >
        ● {dbReady ? "DB" : "No DB"}
      </span>
      <span className="text-[var(--text-secondary)]/60">
        Session <code className="font-mono">{sessionId.slice(0, 8)}</code> · {turnCount} turn
        {turnCount === 1 ? "" : "s"} · since {formatTime(hydrated?.started_at)}
      </span>
      <button
        type="button"
        onClick={() => void end()}
        className="rounded-full border border-[var(--border-subtle)] px-3 py-0.5 text-[var(--text-secondary)]/70 hover:border-red-500/40 hover:text-red-400"
      >
        End
      </button>
    </div>
  );
}