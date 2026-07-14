/**
 * Platform moderation identity (Phase 5). Admin wallets act as content
 * moderators and as the dispute arbiter in preview mode. On-chain, the arbiter
 * is enforced by the contract itself; this list only gates the UI and the
 * preview-mode API.
 *
 * NEXT_PUBLIC_ so the same env var works in server routes and client gating.
 * Comma-separated wallet addresses.
 */
export const ADMIN_ADDRESSES = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

export function isAdminAddress(address?: string | null): boolean {
  return !!address && ADMIN_ADDRESSES.includes(address.toLowerCase());
}

/**
 * Dispute window after the deadline during which a hunter can contest a silent
 * reclaim. Mirrors the contract's `disputeWindow` (72h default per the plan).
 */
export const DISPUTE_WINDOW_SECS = 72 * 60 * 60;
