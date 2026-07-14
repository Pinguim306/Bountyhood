"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useBountyActions } from "@/lib/useBountyActions";
import { REPORT_REASONS } from "@/lib/types";

/**
 * Content-policy report flow (Phase 5): a low-key link that expands into a
 * small form. Reports feed the moderation queue at /admin.
 */
export function ReportButton({ bountyId }: { bountyId: string }) {
  const { address, isConnected } = useAccount();
  const { report } = useBountyActions();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <span className="text-xs text-zinc-500">
        Report received — thanks. Our moderators will take a look.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-600 underline-offset-2 transition hover:text-zinc-400 hover:underline"
      >
        Report this bounty
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          if (!address) throw new Error("Connect a wallet to report");
          await report(bountyId, address, reason, details);
          setDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to report");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4"
    >
      <div className="text-sm font-semibold text-white">Report this bounty</div>
      <p className="mt-1 text-xs text-zinc-500">
        Flags the bounty for moderator review. See our{" "}
        <a href="/terms" className="text-zinc-400 underline underline-offset-2">
          content policy
        </a>
        .
      </p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-lime/50"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        placeholder="Anything that helps the moderators (optional)"
        className="mt-2 w-full resize-y rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !isConnected}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
          {busy ? "Reporting…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
        {!isConnected && (
          <span className="text-xs text-zinc-600">Connect a wallet first.</span>
        )}
      </div>
      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
    </form>
  );
}
