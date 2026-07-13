"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { BountyStatus } from "@/lib/contract";
import { shortAddress } from "@/lib/format";
import { useBountyActions } from "@/lib/useBountyActions";
import type { Bounty, Submission } from "@/lib/types";

export function BountyWorkspace({ bounty }: { bounty: Bounty }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const actions = useBountyActions();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCreator =
    isConnected && address?.toLowerCase() === bounty.creator.toLowerCase();
  const isOpen = bounty.status === BountyStatus.Open;
  const expired = Math.floor(Date.now() / 1000) > bounty.deadline;
  const alreadySubmitted =
    !!address &&
    submissions.some((s) => s.hunter.toLowerCase() === address.toLowerCase());

  async function loadSubmissions() {
    const res = await fetch(`/api/bounties/${bounty.id}/submissions`);
    setSubmissions(res.ok ? await res.json() : []);
    setLoading(false);
  }
  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounty.id]);

  async function refresh() {
    await loadSubmissions();
    router.refresh();
  }

  function guard<T extends unknown[]>(key: string, fn: (...a: T) => Promise<void>) {
    return async (...args: T) => {
      setError(null);
      setBusy(key);
      try {
        await fn(...args);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    };
  }

  return (
    <div className="space-y-8">
      {/* Hunter submit form */}
      {isOpen && !expired && !isCreator && (
        <SubmitForm
          disabled={!isConnected || alreadySubmitted}
          hint={
            !isConnected
              ? "Connect a wallet to submit."
              : alreadySubmitted
                ? "You've already submitted to this bounty."
                : undefined
          }
          busy={busy === "submit"}
          onSubmit={guard("submit", async (summary: string, links: string) => {
            if (!address) throw new Error("Connect a wallet first");
            await actions.submit(bounty.id, address, summary, links);
          })}
        />
      )}

      {/* Creator controls */}
      {isCreator && isOpen && (
        <div className="rounded-2xl border border-lime/30 bg-lime/[0.06] p-5">
          <div className="text-sm font-semibold text-lime">You own this bounty</div>
          <p className="mt-1 text-sm text-zinc-400">
            Approve a submission to release the escrow, cancel while there are no
            submissions, or reclaim after the deadline.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {bounty.submissionCount === 0 && !expired && (
              <button
                disabled={!!busy}
                onClick={guard("cancel", async () => {
                  await actions.lifecycle("cancel", bounty.id, address!);
                })}
                className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-ink-700 disabled:opacity-50"
              >
                {busy === "cancel" ? "Cancelling…" : "Cancel & refund"}
              </button>
            )}
            {expired && (
              <button
                disabled={!!busy}
                onClick={guard("reclaim", async () => {
                  await actions.lifecycle("reclaim", bounty.id, address!);
                })}
                className="rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-ink-700 disabled:opacity-50"
              >
                {busy === "reclaim" ? "Reclaiming…" : "Reclaim escrow"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submissions list */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Submissions ({submissions.length})
        </h2>

        {loading ? (
          <div className="mt-3 text-sm text-zinc-600">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-ink-700 p-6 text-sm text-zinc-500">
            No submissions yet. Be the first to deliver.
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {submissions.map((s) => (
              <li
                key={s.id}
                className={`rounded-2xl border p-4 ${
                  s.approved
                    ? "border-lime/50 bg-lime/[0.06]"
                    : "border-ink-800 bg-ink-900/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-zinc-300">
                    {shortAddress(s.hunter)}
                  </span>
                  {s.approved ? (
                    <span className="rounded-full border border-lime/50 bg-lime/10 px-2.5 py-0.5 text-xs font-semibold text-lime">
                      Winner · paid
                    </span>
                  ) : (
                    isCreator &&
                    isOpen && (
                      <button
                        disabled={!!busy}
                        onClick={guard("approve", async () => {
                          await actions.approve(bounty.id, address!, s.id, s.hunter);
                        })}
                        className="rounded-lg bg-lime px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-lime-bright disabled:opacity-50"
                      >
                        {busy === "approve" ? "Approving…" : "Approve & pay"}
                      </button>
                    )
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                  {s.summary}
                </p>
                {s.links && (
                  <div className="mt-2 space-y-1">
                    {s.links
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-sky-400 hover:underline"
                        >
                          {url}
                        </a>
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}

function SubmitForm({
  onSubmit,
  disabled,
  hint,
  busy,
}: {
  onSubmit: (summary: string, links: string) => void;
  disabled?: boolean;
  hint?: string;
  busy?: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [links, setLinks] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(summary, links);
      }}
      className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5"
    >
      <div className="text-sm font-semibold text-white">Submit your work</div>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={3}
        placeholder="What did you deliver? How does it meet the criteria?"
        disabled={disabled}
        className="mt-3 w-full resize-y rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50 disabled:opacity-60"
      />
      <input
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        placeholder="Proof links (repo, demo, tweet) — space or newline separated"
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50 disabled:opacity-60"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled || busy}
          className="rounded-xl bg-lime px-5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-lime-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit work"}
        </button>
        {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      </div>
    </form>
  );
}
