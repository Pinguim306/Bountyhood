import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth";
import { addReport } from "@/lib/store";
import { REPORT_REASONS, type ReportReason } from "@/lib/types";

/** Flag a bounty for moderation. Reporter identity comes from the session. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSessionAddress();
  if (!session)
    return NextResponse.json(
      { error: "Sign in with your wallet first" },
      { status: 401 }
    );

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { reason, details } = body as Record<string, string>;
  if (!REPORT_REASONS.includes(reason as ReportReason)) {
    return NextResponse.json({ error: "Pick a report reason" }, { status: 400 });
  }

  try {
    const report = await addReport({
      bountyId: params.id,
      reporter: session,
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
