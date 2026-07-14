import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth";
import { isContractConfigured } from "@/lib/contract";
import { hasSubmittedOnChain, isOnChainId } from "@/lib/onchain";
import { addSubmission, getSubmissions } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(await getSubmissions(params.id));
}

/**
 * Record a submission. The hunter identity comes from the SIWE session — never
 * the body. With a contract configured, the proof must already be anchored
 * on-chain (`hasSubmitted`), so nobody can fake a submission for a wallet that
 * never transacted.
 */
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

  const { summary, links } = body as Record<string, string>;
  if (!summary?.trim()) {
    return NextResponse.json(
      { error: "Describe what you delivered" },
      { status: 400 }
    );
  }

  if (isContractConfigured && isOnChainId(params.id)) {
    let anchored = false;
    try {
      anchored = await hasSubmittedOnChain(params.id, session);
    } catch {
      return NextResponse.json(
        { error: "Could not verify the submission on-chain — try again" },
        { status: 502 }
      );
    }
    if (!anchored)
      return NextResponse.json(
        { error: "Anchor your submission on-chain first" },
        { status: 400 }
      );
  }

  try {
    const submission = await addSubmission({
      bountyId: params.id,
      hunter: session,
      summary,
      links: links || "",
    });
    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit" },
      { status: 400 }
    );
  }
}
