import { NextResponse } from "next/server";
import { clearSession, getSessionAddress } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Who is signed in (wallet address) — or null. */
export async function GET() {
  return NextResponse.json({ address: await getSessionAddress() });
}

/** Sign out. */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
