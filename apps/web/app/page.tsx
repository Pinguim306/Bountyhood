import Link from "next/link";
import { ActivityFeed } from "@/components/ActivityFeed";
import { BountyGrid } from "@/components/BountyGrid";
import { BountyStatus, isContractConfigured } from "@/lib/contract";
import { formatReward } from "@/lib/format";
import { activityFeed } from "@/lib/reputation";
import { getAllSubmissions, getBounties } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [bounties, submissions] = await Promise.all([
    getBounties(),
    getAllSubmissions(),
  ]);
  const recent = activityFeed(bounties, submissions, 8);
  const openCount = bounties.filter((b) => b.status === BountyStatus.Open).length;
  const totalOpenReward = bounties
    .filter((b) => b.status === BountyStatus.Open)
    .reduce((sum, b) => sum + BigInt(b.rewardWei), 0n);
  const totalSubmissions = bounties.reduce((s, b) => s + b.submissionCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="py-14 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-medium text-lime">
          <span className="h-1.5 w-1.5 rounded-full bg-lime" />
          Live on Robinhood Chain
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
          Pay anyone to do <span className="text-lime">anything.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          Post a bounty, lock the reward in escrow on-chain, and pay out the
          moment someone delivers. No middleman holding your funds.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/create"
            className="rounded-xl bg-lime px-6 py-3 font-semibold text-ink-950 transition hover:bg-lime-bright"
          >
            Create a bounty
          </Link>
          <a
            href="#bounties"
            className="rounded-xl border border-ink-700 px-6 py-3 font-semibold text-zinc-200 transition hover:border-ink-600 hover:bg-ink-800"
          >
            Browse bounties
          </a>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4">
          {[
            { label: "Open bounties", value: openCount.toString() },
            { label: "Rewards in escrow", value: formatReward(totalOpenReward.toString()) },
            { label: "Submissions", value: totalSubmissions.toLocaleString() },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5"
            >
              <div className="font-mono text-2xl font-bold text-white">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {!isContractConfigured && (
          <p className="mx-auto mt-6 max-w-xl text-xs text-zinc-600">
            Preview mode — showing sample data. Set{" "}
            <code className="text-zinc-400">NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS</code>{" "}
            to read live bounties from the deployed contract.
          </p>
        )}
      </section>

      {/* Grid */}
      <section id="bounties" className="pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Bounties</h2>
        </div>
        <BountyGrid bounties={bounties} />
      </section>

      {/* Activity */}
      {recent.length > 0 && (
        <section className="pb-20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Latest activity</h2>
            <Link
              href="/activity"
              className="text-sm text-zinc-400 transition hover:text-lime"
            >
              View all →
            </Link>
          </div>
          <div className="rounded-2xl border border-ink-800 bg-ink-900/40 px-5">
            <ActivityFeed events={recent} />
          </div>
        </section>
      )}
    </div>
  );
}
