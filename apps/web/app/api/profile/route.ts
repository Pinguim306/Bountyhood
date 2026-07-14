import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth";
import { updateProfile } from "@/lib/store";

/**
 * Update the signed-in wallet's profile. The address comes exclusively from
 * the SIWE session cookie — you can only ever edit your own profile.
 */
export async function PUT(req: Request) {
  const address = await getSessionAddress();
  if (!address)
    return NextResponse.json(
      { error: "Sign in with your wallet first" },
      { status: 401 }
    );

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, bio, avatarUrl, xHandle } = body as Record<string, string>;
  try {
    const profile = await updateProfile({ address, name, bio, avatarUrl, xHandle });
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 400 }
    );
  }
}
