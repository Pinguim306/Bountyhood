import Link from "next/link";
import { formatReward, timeAgo } from "@/lib/format";
import type { ActivityEvent, ActivityKind } from "@/lib/reputation";
import { AddressLink } from "./AddressLink";

const VERB: Record<ActivityKind, { text: string; tone: string }> = {
  created: { text: "posted", tone: "text-lime" },
  submitted: { text: "submitted to", tone: "text-sky-300" },
  approved: { text: "won", tone: "text-lime-bright" },
  reclaimed: { text: "reclaimed", tone: "text-zinc-400" },
  cancelled: { text: "cancelled", tone: "text-zinc-400" },
  disputed: { text: "disputed", tone: "text-amber-300" },
};

export function ActivityFeed({
  events,
  className = "",
}: {
  events: ActivityEvent[];
  className?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-700 py-12 text-center text-sm text-zinc-500">
        No activity yet.
      </div>
    );
  }
  return (
    <ul className={`divide-y divide-ink-800 ${className}`}>
      {events.map((e) => {
        const verb = VERB[e.kind];
        return (
          <li
            key={e.id}
            className="flex items-center gap-3 py-3 text-sm"
          >
            <AddressLink address={e.actor} withIcon iconSize={24} className="shrink-0" />
            <span className="min-w-0 flex-1 text-zinc-400">
              <span className={`font-medium ${verb.tone}`}>{verb.text}</span>{" "}
              <Link
                href={`/bounty/${e.bountyId}`}
                className="truncate font-medium text-zinc-200 transition hover:text-white"
              >
                {e.bountyTitle}
              </Link>
            </span>
            <span className="shrink-0 font-mono text-xs text-lime/80">
              {formatReward(e.rewardWei)}
            </span>
            <span className="shrink-0 whitespace-nowrap text-xs text-zinc-600">
              {timeAgo(e.at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
