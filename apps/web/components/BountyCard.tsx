import Link from "next/link";
import { BountyStatus } from "@/lib/contract";
import { formatReward, shortAddress, timeLeft } from "@/lib/format";
import type { Bounty } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const { label: countdown, ended } = timeLeft(bounty.deadline);
  const isOpen = bounty.status === BountyStatus.Open;

  return (
    <Link
      href={`/bounty/${bounty.id}`}
      className="group flex flex-col rounded-2xl border border-ink-800 bg-ink-900/60 p-5 transition hover:border-lime/40 hover:bg-ink-850"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
          {bounty.category}
        </span>
        <StatusBadge status={bounty.status} />
      </div>

      <h3 className="mb-2 line-clamp-2 text-base font-semibold text-white group-hover:text-lime-bright">
        {bounty.title}
      </h3>
      <p className="mb-4 line-clamp-2 text-sm text-zinc-400">
        {bounty.description}
      </p>

      <div className="mt-auto flex items-end justify-between">
        <div>
          <div className="text-xs text-zinc-500">Reward</div>
          <div className="font-mono text-xl font-bold text-lime">
            {formatReward(bounty.rewardWei)}
          </div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div className={isOpen && !ended ? "text-zinc-300" : ""}>
            {countdown}
          </div>
          <div className="mt-1">
            {bounty.submissionCount} submission
            {bounty.submissionCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-ink-800 pt-3 text-xs text-zinc-500">
        by {shortAddress(bounty.creator)}
      </div>
    </Link>
  );
}
