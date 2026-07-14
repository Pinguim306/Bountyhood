import { AddressLink } from "@/components/AddressLink";
import { formatReward } from "@/lib/format";
import {
  creatorLeaderboard,
  hunterLeaderboard,
  type CreatorRank,
  type HunterRank,
} from "@/lib/reputation";
import { getAllSubmissions, getBounties } from "@/lib/store";

export const dynamic = "force-dynamic";

const RANK_TONE = [
  "text-amber-300", // 1st
  "text-zinc-300", // 2nd
  "text-orange-300", // 3rd
];

export default async function LeaderboardPage() {
  const [bounties, submissions] = await Promise.all([
    getBounties(),
    getAllSubmissions(),
  ]);
  const hunters = hunterLeaderboard(bounties, submissions).slice(0, 25);
  const creators = creatorLeaderboard(bounties).slice(0, 25);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Leaderboard
      </h1>
      <p className="mt-2 text-zinc-400">
        The hunters earning the most and the creators funding the most work on
        Bountyhood.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Hunters */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-white">Top hunters</h2>
          {hunters.length === 0 ? (
            <Empty text="No paid-out bounties yet." />
          ) : (
            <ol className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900/60">
              {hunters.map((h, i) => (
                <HunterRow key={h.address} rank={i} row={h} />
              ))}
            </ol>
          )}
        </section>

        {/* Creators */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-white">Top creators</h2>
          {creators.length === 0 ? (
            <Empty text="No bounties posted yet." />
          ) : (
            <ol className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900/60">
              {creators.map((c, i) => (
                <CreatorRow key={c.address} rank={i} row={c} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Rank({ i }: { i: number }) {
  return (
    <span
      className={`w-6 shrink-0 text-center font-mono text-sm font-bold ${
        RANK_TONE[i] ?? "text-zinc-600"
      }`}
    >
      {i + 1}
    </span>
  );
}

function HunterRow({ rank, row }: { rank: number; row: HunterRank }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Rank i={rank} />
      <AddressLink address={row.address} iconSize={28} className="min-w-0 flex-1" />
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-lime">
          {formatReward(row.earned)}
        </div>
        <div className="text-xs text-zinc-600">
          {row.wins} win{row.wins === 1 ? "" : "s"} · {row.submissions} sub
          {row.submissions === 1 ? "" : "s"}
        </div>
      </div>
    </li>
  );
}

function CreatorRow({ rank, row }: { rank: number; row: CreatorRank }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Rank i={rank} />
      <AddressLink address={row.address} iconSize={28} className="min-w-0 flex-1" />
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-white">
          {formatReward(row.rewards)}
        </div>
        <div className="text-xs text-zinc-600">
          {row.posted} posted · {formatReward(row.paidOut)} paid
        </div>
      </div>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 py-12 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}
