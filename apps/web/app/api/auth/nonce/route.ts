import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Fresh nonce for the sign-in message (valid for 10 minutes). */
export async function GET() {
  return NextResponse.json({ nonce: issueNonce() });
}
