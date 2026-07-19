import { DISPUTE_WINDOW_SECS } from "./admin";
import { BountyStatus } from "./contract";
import { getAllSubmissions, getBounties } from "./store";

/**
 * In-app notifications, derived on demand from bounty + submission state — no
 * extra tables, nothing to get stale. "Seen" state lives client-side.
 *
 * The one that matters most: a hunter's submitted bounty entered the 72h
 * dispute window unpaid — act now or the creator can reclaim.
 */
export interface AppNotification {
  id: string; // stable, so the client can track seen-state
  kind: "dispute-window" | "dispute-opened" | "won" | "reclaimable";
  urgent: boolean;
  title: string;
  body: string;
  href: string;
  at: number; // unix ms, for ordering
}

export async function getNotificationsFor(
  address: string
): Promise<AppNotification[]> {
  const me = address.toLowerCase();
  const [bounties, submissions] = await Promise.all([
    getBounties({ includeHidden: true }),
    getAllSubmissions(),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const out: AppNotification[] = [];

  const mySubmissionBountyIds = new Set(
    submissions
      .filter((s) => s.hunter.toLowerCase() === me)
      .map((s) => s.bountyId)
  );

  for (const b of bounties) {
    const isCreator = b.creator.toLowerCase() === me;
    const iSubmitted = mySubmissionBountyIds.has(b.id);
    const windowEnd = b.deadline + DISPUTE_WINDOW_SECS;

    // Hunter: expired unpaid, dispute window still open — the critical alert.
    if (
      iSubmitted &&
      !isCreator &&
      b.status === BountyStatus.Open &&
      now > b.deadline &&
      now <= windowEnd
    ) {
      out.push({
        id: `dw-${b.id}`,
        kind: "dispute-window",
        urgent: true,
        title: "Dispute window open",
        body: `"${b.title}" expired unpaid. Open a dispute before ${new Date(
          windowEnd * 1000
        ).toLocaleString()} or the creator can reclaim the reward.`,
        href: `/bounty/${b.id}`,
        at: b.deadline * 1000,
      });
    }

    // Hunter: you got paid.
    if (b.status === BountyStatus.Paid && b.winner?.toLowerCase() === me) {
      out.push({
        id: `won-${b.id}`,
        kind: "won",
        urgent: false,
        title: "You got paid 🎉",
        body: `"${b.title}" was approved and the escrow paid you.`,
        href: `/bounty/${b.id}`,
        at: b.deadline * 1000,
      });
    }

    // Creator: your bounty is under dispute — respond in the thread.
    if (isCreator && b.status === BountyStatus.Disputed) {
      out.push({
        id: `do-${b.id}`,
        kind: "dispute-opened",
        urgent: true,
        title: "Your bounty is under dispute",
        body: `"${b.title}" was contested. Present your side in the evidence thread before the arbiter rules.`,
        href: `/bounty/${b.id}`,
        at: b.deadline * 1000,
      });
    }

    // Creator: window elapsed with no dispute — escrow is reclaimable.
    if (isCreator && b.status === BountyStatus.Open && now > windowEnd) {
      out.push({
        id: `rc-${b.id}`,
        kind: "reclaimable",
        urgent: false,
        title: "Escrow reclaimable",
        body: `"${b.title}" expired with no approval or dispute — you can reclaim the reward.`,
        href: `/bounty/${b.id}`,
        at: windowEnd * 1000,
      });
    }
  }

  return out
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.at - a.at)
    .slice(0, 20);
}
