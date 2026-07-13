import { NextResponse } from "next/server";
import { parseEther } from "viem";
import { createBounty, getBounties } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getBounties());
}

/**
 * Create a bounty (preview mode). In production this endpoint would only persist
 * off-chain metadata and return a hash; the escrow itself is created on-chain by
 * the client. Here it mints a local bounty so the flow is demoable end-to-end.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { title, description, deliverables, category, creator, rewardEth, deadline } =
    body as Record<string, string>;

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: "Title and description are required" },
      { status: 400 }
    );
  }
  const cat = CATEGORIES.includes(category as never) ? category : "Other";
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
    metadata: {
      title: title.trim(),
      description: description.trim(),
      deliverables: (deliverables || "").trim(),
      category: cat,
      creator: creator || "0x0000000000000000000000000000000000000000",
    },
    rewardWei,
    deadline: Math.floor(deadlineSec),
  });

  return NextResponse.json(bounty, { status: 201 });
}
