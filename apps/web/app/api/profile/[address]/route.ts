import { NextResponse } from "next/server";
import { getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public profile for a wallet — null body when none exists yet. */
export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(params.address))
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const profile = await getProfile(params.address);
  return NextResponse.json(profile ?? null, {
    headers: { "cache-control": "public, max-age=30" },
  });
}
