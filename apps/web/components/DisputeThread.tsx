"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isAdminAddress } from "@/lib/admin";
import { useAuth } from "@/lib/useAuth";
import type { DisputeComment } from "@/lib/types";
import { AddressLink } from "./AddressLink";

/**
 * Public evidence thread on a disputed bounty. Both sides (and moderators) can
 * post while the dispute is open; once the arbiter rules, the thread freezes
 * and stays visible as the record the ruling was based on.
 */
export function DisputeThread({
  bountyId,
  isCreatorHere,
  iSubmittedHere,
  frozen,
}: {
  bountyId: string;
  isCreatorHere: boolean;
  iSubmittedHere: boolean;
  frozen: boolean;
}) {
  const { address, isConnected } = useAccount();
  const { isSignedIn, signIn } = useAuth();
  const [comments, setComments] = useState<DisputeComment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/bounties/${bountyId}/dispute-comments`);
    setComments(res.ok ? await res.json() : []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId]);

  const canPost =
    !frozen &&
    isConnected &&
    (isCreatorHere || iSubmittedHere || isAdminAddress(address));

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!isSignedIn) await signIn();
      const res = await fetch(`/api/bounties/${bountyId}/dispute-comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error || "Could not post");
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post");
    } finally {
      setBusy(false);
    }
  }

  if (frozen && comments.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Dispute evidence ({comments.length})
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        {frozen
          ? "This dispute has been resolved — the thread below is the record the arbiter ruled on."
          : "State your case here. Both sides and the arbiter see everything posted; the thread freezes once the dispute is resolved."}
      </p>

      {comments.length > 0 && (
        <ul className="mt-4 space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-ink-800 bg-ink-950/60 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <AddressLink
                  address={c.author}
                  iconSize={18}
                  className="text-xs text-zinc-300"
                />
                <span className="shrink-0 text-[11px] text-zinc-600">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <form onSubmit={post} className="mt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Present your evidence — what was delivered, links, timeline…"
            className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime/50"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="rounded-lg bg-amber-400/90 px-4 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Posting…" : "Post evidence"}
            </button>
            <span className="text-[11px] text-zinc-600">
              {body.length}/1000
            </span>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-300">{error}</p>
          )}
        </form>
      )}
    </section>
  );
}
