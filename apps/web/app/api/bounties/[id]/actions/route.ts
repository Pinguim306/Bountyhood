import { NextResponse } from "next/server";
import {
  approveSubmission,
  cancelBounty,
  reclaimBounty,
} from "@/lib/store";

/**
 * Creator lifecycle actions in preview mode: approve a submission, cancel, or
 * reclaim. In live mode these are contract calls; this endpoint mirrors the
 * resulting state so the UI stays consistent.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { action, caller, submissionId } = body as Record<string, string>;
  if (!caller) {
    return NextResponse.json({ error: "Connect a wallet first" }, { status: 400 });
  }

  try {
    let bounty;
    if (action === "approve") {
      if (!submissionId) throw new Error("Missing submissionId");
      bounty = await approveSubmission({
        bountyId: params.id,
        submissionId,
        caller,
      });
    } else if (action === "cancel") {
      bounty = await cancelBounty({ bountyId: params.id, caller });
    } else if (action === "reclaim") {
      bounty = await reclaimBounty({ bountyId: params.id, caller });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json(bounty);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 }
    );
  }
}
