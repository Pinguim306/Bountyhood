import { NextResponse } from "next/server";
import { addReport } from "@/lib/store";
import { REPORT_REASONS, type ReportReason } from "@/lib/types";

/** Flag a bounty for moderation. Off-chain only — feeds the admin queue. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { reporter, reason, details } = body as Record<string, string>;
  if (!reporter) {
    return NextResponse.json({ error: "Connect a wallet first" }, { status: 400 });
  }
  if (!REPORT_REASONS.includes(reason as ReportReason)) {
    return NextResponse.json({ error: "Pick a report reason" }, { status: 400 });
  }

  try {
    const report = await addReport({
      bountyId: params.id,
      reporter,
      reason: reason as ReportReason,
      details: details ?? "",
    });
    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to report" },
      { status: 400 }
    );
  }
}
