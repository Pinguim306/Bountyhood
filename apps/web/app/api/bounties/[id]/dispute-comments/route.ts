import { NextResponse } from "next/server";
import { isAdminAddress } from "@/lib/admin";
import { getSessionAddress } from "@/lib/auth";
import { addDisputeComment, getDisputeComments } from "@/lib/store";

/**
 * Evidence thread on a disputed bounty. Reading is public — disputes are
 * resolved in the open. Posting requires a SIWE session and is limited by the
 * store to the bounty's creator, its submitters, and the arbiter, and only
 * while the bounty is actually Disputed.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(await getDisputeComments(params.id));
}

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
  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const comment = await addDisputeComment({
      bountyId: params.id,
      author: caller,
      body: String((body as Record<string, unknown>).body ?? ""),
      isModerator: isAdminAddress(caller),
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not post comment" },
      { status: 400 }
    );
  }
}
