import { BountyStatus } from "./contract";
import type { Bounty, Submission } from "./types";

/**
 * Reputation & discovery aggregates (Phase 4). Pure functions over the bounty +
 * submission sets so they work identically off the JSON preview store or a real
 * indexer feed. No IO here — callers pass the data in.
 */

const addr = (a?: string) => (a ?? "").toLowerCase();
const sumWei = (rows: string[]) => rows.reduce((s, w) => s + BigInt(w), 0n);

/* --------------------------------- profile -------------------------------- */

export interface ProfileStats {
  address: string;
  /** Bounties this address created. */
  created: number;
  createdOpen: number;
  /** Reward still locked in escrow on their open bounties (wei). */
  escrowed: string;
  /** Reward they paid out to hunters on bounties they created (wei). */
  paidOut: string;
  /** Submissions this address made as a hunter. */
  submissions: number;
  /** Bounties this address won. */
  wins: number;
  /** Total reward earned as a hunter, gross of platform fee (wei). */
  earned: string;
}

export function profileStats(
  address: string,
  bounties: Bounty[],
  submissions: Submission[]
): ProfileStats {
  const me = addr(address);
  const created = bounties.filter((b) => addr(b.creator) === me);
  const won = bounties.filter(
    (b) => b.status === BountyStatus.Paid && addr(b.winner) === me
  );
  const mySubs = submissions.filter((s) => addr(s.hunter) === me);
  return {
    address,
    created: created.length,
    createdOpen: created.filter((b) => b.status === BountyStatus.Open).length,
    escrowed: sumWei(
      created
        .filter((b) => b.status === BountyStatus.Open)
        .map((b) => b.rewardWei)
    ).toString(),
    paidOut: sumWei(
      created
        .filter((b) => b.status === BountyStatus.Paid)
        .map((b) => b.rewardWei)
    ).toString(),
    submissions: mySubs.length,
    wins: won.length,
    earned: sumWei(won.map((b) => b.rewardWei)).toString(),
  };
}

/** Bounties created by an address, newest first. */
export function bountiesBy(address: string, bounties: Bounty[]): Bounty[] {
  const me = addr(address);
  return bounties.filter((b) => addr(b.creator) === me);
}

/** Bounties an address won, newest first. */
export function bountiesWonBy(address: string, bounties: Bounty[]): Bounty[] {
  const me = addr(address);
  return bounties.filter(
    (b) => b.status === BountyStatus.Paid && addr(b.winner) === me
  );
}

/* ------------------------------- leaderboard ------------------------------ */

export interface HunterRank {
  address: string;
  earned: string; // wei
  wins: number;
  submissions: number;
}

export interface CreatorRank {
  address: string;
  posted: number;
  rewards: string; // wei, total across all their bounties
  paidOut: string; // wei, paid to hunters
}

/** Hunters ranked by total earned, then wins. Only ranks addresses with wins. */
export function hunterLeaderboard(
  bounties: Bounty[],
  submissions: Submission[]
): HunterRank[] {
  const acc = new Map<string, HunterRank>();
  const get = (a: string) => {
    const key = addr(a);
    let row = acc.get(key);
    if (!row) {
      row = { address: a, earned: "0", wins: 0, submissions: 0 };
      acc.set(key, row);
    }
    return row;
  };
  for (const s of submissions) get(s.hunter).submissions += 1;
  for (const b of bounties) {
    if (b.status === BountyStatus.Paid && b.winner) {
      const row = get(b.winner);
      row.wins += 1;
      row.earned = (BigInt(row.earned) + BigInt(b.rewardWei)).toString();
    }
  }
  return [...acc.values()]
    .filter((r) => r.wins > 0)
    .sort(
      (a, b) =>
        Number(BigInt(b.earned) - BigInt(a.earned)) || b.wins - a.wins
    );
}

/** Creators ranked by total rewards posted, then bounties posted. */
export function creatorLeaderboard(bounties: Bounty[]): CreatorRank[] {
  const acc = new Map<string, CreatorRank>();
  for (const b of bounties) {
    const key = addr(b.creator);
    let row = acc.get(key);
    if (!row) {
      row = { address: b.creator, posted: 0, rewards: "0", paidOut: "0" };
      acc.set(key, row);
    }
    row.posted += 1;
    row.rewards = (BigInt(row.rewards) + BigInt(b.rewardWei)).toString();
    if (b.status === BountyStatus.Paid)
      row.paidOut = (BigInt(row.paidOut) + BigInt(b.rewardWei)).toString();
  }
  return [...acc.values()].sort(
    (a, b) => Number(BigInt(b.rewards) - BigInt(a.rewards)) || b.posted - a.posted
  );
}

/* ------------------------------ activity feed ----------------------------- */

export type ActivityKind =
  | "created"
  | "submitted"
  | "approved"
  | "reclaimed"
  | "cancelled";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  at: number; // unix ms
  actor: string; // address that triggered it
  bountyId: string;
  bountyTitle: string;
  rewardWei: string;
}

/**
 * A merged, newest-first activity stream derived from bounties + submissions.
 *
 * Preview mode has no per-transition timestamps (the JSON store keeps only the
 * latest state), so approval/reclaim/cancel times are approximated from data we
 * do have: an approval is dated from its winning submission, an expiry from the
 * deadline, a cancellation from creation. A real indexer would carry the block
 * timestamp of each event instead.
 */
export function activityFeed(
  bounties: Bounty[],
  submissions: Submission[],
  limit = 40
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const byId = new Map(bounties.map((b) => [b.id, b]));

  for (const b of bounties) {
    events.push({
      id: `created-${b.id}`,
      kind: "created",
      at: b.createdAt,
      actor: b.creator,
      bountyId: b.id,
      bountyTitle: b.title,
      rewardWei: b.rewardWei,
    });
    if (b.status === BountyStatus.Cancelled) {
      events.push({
        id: `cancelled-${b.id}`,
        kind: "cancelled",
        at: b.createdAt,
        actor: b.creator,
        bountyId: b.id,
        bountyTitle: b.title,
        rewardWei: b.rewardWei,
      });
    }
    if (b.status === BountyStatus.Reclaimed) {
      events.push({
        id: `reclaimed-${b.id}`,
        kind: "reclaimed",
        at: b.deadline * 1000,
        actor: b.creator,
        bountyId: b.id,
        bountyTitle: b.title,
        rewardWei: b.rewardWei,
      });
    }
  }

  for (const s of submissions) {
    const b = byId.get(s.bountyId);
    if (!b) continue;
    events.push({
      id: `submitted-${s.id}`,
      kind: "submitted",
      at: s.createdAt,
      actor: s.hunter,
      bountyId: b.id,
      bountyTitle: b.title,
      rewardWei: b.rewardWei,
    });
    if (s.approved) {
      events.push({
        id: `approved-${s.id}`,
        kind: "approved",
        at: s.createdAt,
        actor: s.hunter,
        bountyId: b.id,
        bountyTitle: b.title,
        rewardWei: b.rewardWei,
      });
    }
  }

  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}
