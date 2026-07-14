"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { AddressLink } from "@/components/AddressLink";
import { isAdminAddress } from "@/lib/admin";
import { formatReward, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import { useBountyActions } from "@/lib/useBountyActions";
import type { Bounty, ModerationEntry, Report, Submission } from "@/lib/types";

interface AdminData {
  reports: (Report & { bountyTitle: string; bountyHidden: boolean })[];
  disputes: { bounty: Bounty; submissions: Submission[] }[];
  hidden: (ModerationEntry & { bountyTitle: string })[];
}

/**
 * Moderation panel (Phase 5): report queue, dispute queue, hidden list.
 * Gated to wallets in NEXT_PUBLIC_ADMIN_ADDRESSES — the same wallets act as
 * the dispute arbiter in preview mode.
 */
export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { isSignedIn, signIn } = useAuth();
  const { resolve } = useBountyActions();
  const admin = isAdminAddress(address);

  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin"); // session cookie carries identity
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    if (admin && isSignedIn) load();
  }, [admin, isSignedIn, load]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const moderate = (body: Record<string, string>) =>
    fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json()).error || "Action failed");
    });

  if (!isConnected) {
    return (
      <Shell>
        <Notice>Connect a wallet to access the moderation panel.</Notice>
      </Shell>
    );
  }
  if (!admin) {
    return (
      <Shell>
        <Notice>
          This wallet is not a moderator. Add it to{" "}
          <code className="text-zinc-400">NEXT_PUBLIC_ADMIN_ADDRESSES</code> to
          grant access.
        </Notice>
      </Shell>
    );
  }
  if (!isSignedIn) {
    return (
      <Shell>
        <Notice>
          <p>
            Prove you control this moderator wallet with a one-time signature
            (free, no transaction).
          </p>
          <button
            onClick={() => signIn().catch(() => {})}
            className="mt-4 rounded-xl bg-lime px-5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-lime-bright"
          >
            Sign in with wallet
          </button>
        </Notice>
      </Shell>
    );
  }

  const openReports = data?.reports.filter((r) => r.status === "open") ?? [];
  const closedReports = data?.reports.filter((r) => r.status !== "open") ?? [];

  return (
    <Shell>
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Disputes */}
      <Section
        title={`Disputes (${data?.disputes.length ?? 0})`}
        subtitle="Escrow is frozen until you pay a hunter or refund the creator."
      >
        {!data || data.disputes.length === 0 ? (
          <Empty text="No open disputes." />
        ) : (
          <div className="space-y-4">
            {data.disputes.map(({ bounty, submissions }) => (
              <div
                key={bounty.id}
                className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.04] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/bounty/${bounty.id}`}
                    className="font-semibold text-white hover:text-lime"
                  >
                    {bounty.title}
                  </Link>
                  <span className="font-mono text-sm font-bold text-lime">
                    {formatReward(bounty.rewardWei)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  disputed by <AddressLink address={bounty.disputedBy} iconSize={16} />
                </div>
                <ul className="mt-4 space-y-2">
                  {submissions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-950/60 p-3"
                    >
                      <div className="min-w-0">
                        <AddressLink address={s.hunter} iconSize={18} className="text-sm" />
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                          {s.summary}
                        </p>
                      </div>
                      <button
                        disabled={!!busy}
                        onClick={() =>
                          act(`pay-${s.id}`, () =>
                            resolve(bounty.id, address!, s.id, s.hunter)
                          )
                        }
                        className="shrink-0 rounded-lg bg-lime px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-lime-bright disabled:opacity-50"
                      >
                        {busy === `pay-${s.id}` ? "Paying…" : "Pay this hunter"}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    act(`refund-${bounty.id}`, () =>
                      resolve(bounty.id, address!, null, null)
                    )
                  }
                  className="mt-3 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-ink-700 disabled:opacity-50"
                >
                  {busy === `refund-${bounty.id}`
                    ? "Refunding…"
                    : "Refund creator"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Reports */}
      <Section
        title={`Reports (${openReports.length})`}
        subtitle="Hiding removes a bounty from listings only — the escrow keeps following the contract."
      >
        {openReports.length === 0 ? (
          <Empty text="No open reports." />
        ) : (
          <ul className="space-y-3">
            {openReports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/bounty/${r.bountyId}`}
                    className="font-medium text-white hover:text-lime"
                  >
                    {r.bountyTitle}
                  </Link>
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                    {r.reason}
                  </span>
                </div>
                {r.details && (
                  <p className="mt-2 text-sm text-zinc-400">{r.details}</p>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-600">
                  by <AddressLink address={r.reporter} iconSize={14} /> ·{" "}
                  {timeAgo(r.createdAt)}
                </div>
                <div className="mt-3 flex gap-2">
                  {!r.bountyHidden && (
                    <button
                      disabled={!!busy}
                      onClick={() =>
                        act(`hide-${r.id}`, () =>
                          moderate({
                            action: "hide",
                            bountyId: r.bountyId,
                            reportId: r.id,
                            reason: r.reason,
                          })
                        )
                      }
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {busy === `hide-${r.id}` ? "Hiding…" : "Hide bounty"}
                    </button>
                  )}
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      act(`dismiss-${r.id}`, () =>
                        moderate({ action: "dismiss", reportId: r.id })
                      )
                    }
                    className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-ink-700 disabled:opacity-50"
                  >
                    {busy === `dismiss-${r.id}` ? "Dismissing…" : "Dismiss"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {closedReports.length > 0 && (
          <p className="mt-3 text-xs text-zinc-600">
            {closedReports.length} resolved report
            {closedReports.length === 1 ? "" : "s"} not shown.
          </p>
        )}
      </Section>

      {/* Hidden bounties */}
      <Section
        title={`Hidden bounties (${data?.hidden.length ?? 0})`}
        subtitle="Restore a bounty to listings if it was hidden in error."
      >
        {!data || data.hidden.length === 0 ? (
          <Empty text="Nothing is hidden." />
        ) : (
          <ul className="space-y-2">
            {data.hidden.map((m) => (
              <li
                key={m.bountyId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-800 bg-ink-900/60 p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/bounty/${m.bountyId}`}
                    className="font-medium text-white hover:text-lime"
                  >
                    {m.bountyTitle}
                  </Link>
                  <div className="mt-1 text-xs text-zinc-600">
                    {m.reason} · {timeAgo(m.hiddenAt)}
                  </div>
                </div>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    act(`unhide-${m.bountyId}`, () =>
                      moderate({ action: "unhide", bountyId: m.bountyId })
                    )
                  }
                  className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-ink-700 disabled:opacity-50"
                >
                  {busy === `unhide-${m.bountyId}` ? "Restoring…" : "Unhide"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Moderation
      </h1>
      <p className="mt-2 text-zinc-400">
        Report queue, dispute arbitration, and hidden bounties.
      </p>
      <div className="mt-8 space-y-10">{children}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-zinc-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 py-10 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6 text-sm text-zinc-400">
      {children}
    </div>
  );
}
