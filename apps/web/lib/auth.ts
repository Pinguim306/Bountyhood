import { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";

/**
 * Wallet auth (SIWE-style), server-only. Stateless: nonces and sessions are
 * HMAC-signed tokens, so no auth tables are needed and it works identically on
 * the JSON and Postgres backends.
 *
 * Flow: GET /api/auth/nonce -> wallet signs the message from siwe-message.ts
 * -> POST /api/auth/verify checks the signature (viem) and sets an httpOnly
 * session cookie -> profile writes read the address from that cookie only.
 *
 * Set AUTH_SECRET in production (any long random string). Without it a random
 * per-boot secret is used — fine for dev; sessions just reset on restart.
 */
const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString("hex");

const SESSION_COOKIE = "bh_session";
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 min to sign
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hmac(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/* --------------------------------- nonces --------------------------------- */

export function issueNonce(): string {
  const body = `${Date.now() + NONCE_TTL_MS}.${randomBytes(8).toString("hex")}`;
  return `${body}.${hmac(`nonce:${body}`)}`;
}

export function isValidNonce(nonce: string): boolean {
  const parts = nonce.split(".");
  if (parts.length !== 3) return false;
  const body = `${parts[0]}.${parts[1]}`;
  if (hmac(`nonce:${body}`) !== parts[2]) return false;
  return Number(parts[0]) > Date.now();
}

/* -------------------------------- sessions -------------------------------- */

export async function createSession(address: string): Promise<void> {
  const addr = address.toLowerCase();
  const exp = Date.now() + SESSION_TTL_MS;
  const token = `${addr}.${exp}.${hmac(`session:${addr}.${exp}`)}`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** The signed-in wallet address, or null. Never trusts request bodies. */
export async function getSessionAddress(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [addr, exp, sig] = parts;
  if (hmac(`session:${addr}.${exp}`) !== sig) return null;
  if (Number(exp) <= Date.now()) return null;
  return addr;
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
