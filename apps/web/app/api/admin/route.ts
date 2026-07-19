import { NextResponse } from "next/server";
import { isAdminAddress } from "@/lib/admin";
import { getSessionAddress } from "@/lib/auth";
import { BountyStatus } from "@/lib/contract";
import {
  getBounties,
  getDisputeComments,
  getModeration,
  getReports,
  getSubmissions,
  hideBounty,
  setReportStatus,
  unhideBounty,
} from "@/lib/store";

/**
 * Moderation backend (Phase 5). Moderator identity comes from the SIWE session
 * cookie — being a moderator requires proving control of an allowlisted wallet
 * by signature, not merely naming its address.
 */

const unauthorized = () =>
  NextResponse.json(
    { error: "Sign in with a moderator wallet" },
    { status: 403 }
  );

/** Dashboard data: report queue, dispute queue, and the hidden list. */
export async function GET() {
  const caller = await getSessionAddress();
  if (!isAdminAddress(caller)) return unauthorized();

  const [bounties, reports, moderation] = await Promise.all([
    getBounties({ includeHidden: true }),
    getReports(),
    getModeration(),
  ]);
  const byId = new Map(bounties.map((b) => [b.id, b]));
  const hiddenIds = new Set(moderation.map((m) => m.bountyId));

  const disputed = bounties.filter((b) => b.status === BountyStatus.Disputed);
  const disputes = await Promise.all(
    disputed.map(async (bounty) => ({
      bounty,
      submissions: await getSubmissions(bounty.id),
      comments: await getDisputeComments(bounty.id),
    }))
  );

  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      bountyTitle: byId.get(r.bountyId)?.title ?? "(deleted)",
      bountyHidden: hiddenIds.has(r.bountyId),
    })),
    disputes,
    hidden: moderation.map((m) => ({
      ...m,
      bountyTitle: byId.get(m.bountyId)?.title ?? "(deleted)",
    })),
  });
}

/** Moderation actions: dismiss a report, hide a bounty, or unhide one. */
export async function POST(req: Request) {
  const caller = await getSessionAddress();
  if (!caller || !isAdminAddress(caller)) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { action, reportId, bountyId, reason } = body as Record<string, string>;

  try {
    if (action === "dismiss") {
      if (!reportId) throw new Error("Missing reportId");
      return NextResponse.json(await setReportStatus(reportId, "dismissed"));
    }
    if (action === "hide") {
      if (!bountyId) throw new Error("Missing bountyId");
      const entry = await hideBounty({
        bountyId,
        reason: reason ?? "",
        moderator: caller,
      });
      if (reportId) await setReportStatus(reportId, "actioned");
      return NextResponse.json(entry);
    }
    if (action === "unhide") {
      if (!bountyId) throw new Error("Missing bountyId");
      await unhideBounty(bountyId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 }
    );
  }
}
