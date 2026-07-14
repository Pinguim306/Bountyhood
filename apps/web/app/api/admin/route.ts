import { NextResponse } from "next/server";
import { isAdminAddress } from "@/lib/admin";
import { BountyStatus } from "@/lib/contract";
import {
  getBounties,
  getModeration,
  getReports,
  getSubmissions,
  hideBounty,
  setReportStatus,
  unhideBounty,
} from "@/lib/store";

/**
 * Moderation backend (Phase 5). Preview mode trusts the caller address the same
 * way the rest of the preview API does — real deployments should authenticate
 * moderators with wallet signatures (SIWE) instead.
 */

const unauthorized = () =>
  NextResponse.json({ error: "Not a moderator wallet" }, { status: 403 });

/** Dashboard data: report queue, dispute queue, and the hidden list. */
export async function GET(req: Request) {
  const caller = new URL(req.url).searchParams.get("caller");
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
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { caller, action, reportId, bountyId, reason } = body as Record<
    string,
    string
  >;
  if (!isAdminAddress(caller)) return unauthorized();

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
