import { NextResponse } from "next/server";
import { getNotificationsFor } from "@/lib/notifications";

/**
 * In-app notifications for a wallet. Everything returned is derived from
 * public bounty/submission state, so this endpoint takes the address as a
 * query param instead of requiring a session — nothing private leaks.
 */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  return NextResponse.json(await getNotificationsFor(address));
}
