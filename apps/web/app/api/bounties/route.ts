import { NextResponse } from "next/server";
import { parseEther } from "viem";
import { getSessionAddress } from "@/lib/auth";
import { BountyStatus, isContractConfigured } from "@/lib/contract";
import { isOnChainId, readBountyOnChain } from "@/lib/onchain";
import { createBounty, getBounty, registerOnChainBounty, getBounties } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getBounties());
}

/**
 * Create a bounty. Identity comes from the SIWE session cookie — never from
 * the request body. With a contract configured, the client must have escrowed
 * the reward on-chain first: we verify the bounty exists on-chain and belongs
 * to the caller, and mirror the chain's values (not the client's).
 */
export async function POST(req: Request) {
  const session = await getSessionAddress();
  if (!session)
    return NextResponse.json(
      { error: "Sign in with your wallet first" },
      { status: 401 }
    );

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { title, description, deliverables, category, rewardEth, deadline, id, txHash } =
    body as Record<string, string>;

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: "Title and description are required" },
      { status: 400 }
    );
  }
  const cat = CATEGORIES.includes(category as never) ? category : "Other";
  const metadata = {
    title: title.trim(),
    description: description.trim(),
    deliverables: (deliverables || "").trim(),
    category: cat,
    creator: session,
  };

  /* ------------------------- live mode: verify escrow ---------------------- */
  if (isContractConfigured) {
    if (!id || !isOnChainId(id))
      return NextResponse.json(
        { error: "Missing on-chain bounty id — escrow the reward first" },
        { status: 400 }
      );
    if (await getBounty(id))
      return NextResponse.json({ error: "Bounty already registered" }, { status: 409 });

    let onChain;
    try {
      onChain = await readBountyOnChain(id);
    } catch {
      return NextResponse.json(
        { error: "Could not verify the bounty on-chain — try again" },
        { status: 502 }
      );
    }
    if (!onChain)
      return NextResponse.json(
        { error: "Bounty not found on-chain" },
        { status: 400 }
      );
    if (onChain.creator.toLowerCase() !== session)
      return NextResponse.json(
        { error: "That on-chain bounty belongs to another wallet" },
        { status: 403 }
      );
    if (onChain.status !== BountyStatus.Open)
      return NextResponse.json(
        { error: "That bounty is not open" },
        { status: 400 }
      );

    const bounty = await registerOnChainBounty({
      id,
      metadata,
      rewardWei: onChain.rewardWei.toString(), // chain values, not client's
      deadline: onChain.deadline,
      txHash,
    });
    return NextResponse.json(bounty, { status: 201 });
  }

  /* ------------------------ preview mode: local mint ----------------------- */
  const deadlineSec = Number(deadline);
  if (!Number.isFinite(deadlineSec) || deadlineSec <= Date.now() / 1000) {
    return NextResponse.json(
      { error: "Deadline must be in the future" },
      { status: 400 }
    );
  }
  let rewardWei: string;
  try {
    rewardWei = parseEther(String(rewardEth || "0")).toString();
    if (BigInt(rewardWei) <= 0n) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid reward amount" }, { status: 400 });
  }

  const bounty = await createBounty({
    metadata,
    rewardWei,
    deadline: Math.floor(deadlineSec),
  });
  return NextResponse.json(bounty, { status: 201 });
}
