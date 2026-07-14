import { NextResponse } from "next/server";
import { isAdminAddress } from "@/lib/admin";
import {
  approveSubmission,
  cancelBounty,
  openDispute,
  reclaimBounty,
  resolveDispute,
} from "@/lib/store";

/**
 * Lifecycle actions in preview mode: approve a submission, cancel, reclaim,
 * open a dispute (hunter), or resolve one (arbiter). In live mode these are
 * contract calls; this endpoint mirrors the resulting state so the UI stays
 * consistent.
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
    } else if (action === "dispute") {
      bounty = await openDispute({ bountyId: params.id, caller });
    } else if (action === "resolve") {
      // Arbiter-only. Preview mode trusts the caller address like every other
      // action here; on-chain, the contract enforces the arbiter itself.
      if (!isAdminAddress(caller))
        throw new Error("Only the platform arbiter can resolve disputes");
      bounty = await resolveDispute({
        bountyId: params.id,
        winnerSubmissionId: submissionId || null,
      });
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
