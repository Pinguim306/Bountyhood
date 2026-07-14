import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { createSession, isValidNonce } from "@/lib/auth";
import { buildSignInMessage } from "@/lib/siwe-message";

/**
 * Verify a signed sign-in message and open a session. The message is rebuilt
 * server-side from its parts (never trusted as a blob), so the signature must
 * cover exactly our domain + this wallet + a nonce we issued.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { address, nonce, issuedAt, signature } = body as Record<string, string>;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address ?? ""))
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  if (!nonce || !isValidNonce(nonce))
    return NextResponse.json(
      { error: "Nonce expired — try signing in again" },
      { status: 400 }
    );
  if (!signature || !issuedAt)
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const domain = req.headers.get("host") ?? "bountyhood.fun";
  const message = buildSignInMessage({ domain, address, nonce, issuedAt });

  let ok = false;
  try {
    ok = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    ok = false;
  }
  if (!ok)
    return NextResponse.json({ error: "Signature check failed" }, { status: 401 });

  await createSession(address);
  return NextResponse.json({ address: address.toLowerCase() });
}
