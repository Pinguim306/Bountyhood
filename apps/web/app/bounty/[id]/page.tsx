import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { BountyStatus } from "@/lib/contract";
import { formatReward, shortAddress, timeLeft } from "@/lib/format";
import { getBounty } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BountyPage({
  params,
}: {
  params: { id: string };
}) {
  const bounty = await getBounty(params.id);
  if (!bounty) notFound();

  const { label: countdown } = timeLeft(bounty.deadline);
  const deadlineDate = new Date(bounty.deadline * 1000);
  const isOpen = bounty.status === BountyStatus.Open;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← All bounties
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
              {bounty.category}
            </span>
            <StatusBadge status={bounty.status} />
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            {bounty.title}
          </h1>
          <div className="mt-2 text-sm text-zinc-500">
            Posted by {shortAddress(bounty.creator)}
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-200">
              {bounty.description}
            </p>
          </section>

          {bounty.deliverables && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Deliverables & acceptance criteria
              </h2>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-200">
                {bounty.deliverables}
              </p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Submissions ({bounty.submissionCount})
            </h2>
            <div className="mt-3 rounded-2xl border border-dashed border-ink-700 p-6 text-sm text-zinc-500">
              {isOpen ? (
                <>
                  Submission flow lands in the next phase. Hunters will attach
                  proof here and the creator approves a winner to release escrow.
                </>
              ) : (
                <>This bounty is no longer accepting submissions.</>
              )}
            </div>
          </section>
        </div>

        {/* Reward panel */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
            <div className="text-xs text-zinc-500">Reward in escrow</div>
            <div className="mt-1 font-mono text-3xl font-black text-lime">
              {formatReward(bounty.rewardWei)}
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <Row label="Status" value={<StatusBadge status={bounty.status} />} />
              <Row label="Time left" value={countdown} />
              <Row
                label="Deadline"
                value={deadlineDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              />
              <Row label="Submissions" value={String(bounty.submissionCount)} />
              {bounty.winner && (
                <Row label="Winner" value={shortAddress(bounty.winner)} />
              )}
            </dl>

            <button
              disabled={!isOpen}
              className="mt-6 w-full rounded-xl bg-lime px-4 py-3 font-semibold text-ink-950 transition hover:bg-lime-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isOpen ? "Submit work" : "Closed"}
            </button>
            <p className="mt-3 text-center text-xs text-zinc-600">
              Connect a wallet to submit. Payout releases from escrow on approval.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-200">{value}</dd>
    </div>
  );
}
