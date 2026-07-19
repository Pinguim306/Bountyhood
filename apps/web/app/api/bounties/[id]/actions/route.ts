import { NextResponse } from "next/server";
import { isAdminAddress } from "@/lib/admin";
import { getSessionAddress } from "@/lib/auth";
import { BountyStatus, isContractConfigured } from "@/lib/contract";
import { isEscrowTx, isOnChainId, readBountyOnChain } from "@/lib/onchain";
import {
  approveSubmission,
  cancelBounty,
  getSubmissions,
  openDispute,
  reclaimBounty,
  resolveDispute,
} from "@/lib/store";

/**
 * Lifecycle actions. The caller identity comes from the SIWE session — never
 * the body. With a contract configured, the API only mirrors state transitions
 * it can confirm on-chain (the tx must already be mined), so the database can
 * never diverge from the escrow.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const caller = await getSessionAddress();
  if (!caller)
    return NextResponse.json(
      { error: "Sign in with your wallet first" },
      { status: 401 }
    );

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { action, submissionId } = body as Record<string, string>;

  // Payment receipt: only stored in live mode, and only after confirming it's
  // a successful transaction to the escrow contract — never a bare claim.
  let payoutTxHash: string | undefined;
  const claimedTx = (body as Record<string, string>).payoutTxHash;
  if (isContractConfigured && claimedTx && (await isEscrowTx(claimedTx))) {
    payoutTxHash = claimedTx;
  }

  // Expected on-chain status per action, checked when a contract is live.
  const EXPECTED: Record<string, BountyStatus[]> = {
    approve: [BountyStatus.Paid],
    cancel: [BountyStatus.Cancelled],
    reclaim: [BountyStatus.Reclaimed],
    dispute: [BountyStatus.Disputed],
    resolve: [BountyStatus.Paid, BountyStatus.Reclaimed],
  };

  if (isContractConfigured && isOnChainId(params.id) && EXPECTED[action]) {
    let onChain;
    try {
      onChain = await readBountyOnChain(params.id);
    } catch {
      return NextResponse.json(
        { error: "Could not verify the bounty on-chain — try again" },
        { status: 502 }
      );
    }
    if (!onChain || !EXPECTED[action].includes(onChain.status))
      return NextResponse.json(
        { error: "On-chain state doesn't match — confirm the transaction first" },
        { status: 409 }
      );
    if (action === "approve" && submissionId) {
      const winner = (await getSubmissions(params.id)).find(
        (s) => s.id === submissionId
      )?.hunter;
      if (!winner || onChain.winner.toLowerCase() !== winner.toLowerCase())
        return NextResponse.json(
          { error: "On-chain winner doesn't match that submission" },
          { status: 409 }
        );
    }
  }

  try {
    let bounty;
    if (action === "approve") {
      if (!submissionId) throw new Error("Missing submissionId");
      bounty = await approveSubmission({
        bountyId: params.id,
        submissionId,
        caller,
        payoutTxHash,
      });
    } else if (action === "cancel") {
      bounty = await cancelBounty({ bountyId: params.id, caller });
    } else if (action === "reclaim") {
      bounty = await reclaimBounty({ bountyId: params.id, caller });
    } else if (action === "dispute") {
      bounty = await openDispute({ bountyId: params.id, caller });
    } else if (action === "resolve") {
      // Arbiter-only; on-chain, the contract enforces the arbiter itself.
      if (!isAdminAddress(caller))
        throw new Error("Only the platform arbiter can resolve disputes");
      bounty = await resolveDispute({
        bountyId: params.id,
        winnerSubmissionId: submissionId || null,
        payoutTxHash,
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
