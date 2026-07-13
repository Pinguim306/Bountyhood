import { keccak256, stringToHex } from "viem";

/**
 * Canonical proof hash anchored on-chain via `submit(id, proofHash)`. The same
 * function runs client-side (before the contract call) and server-side (when
 * persisting metadata), so the stored hash always matches the on-chain anchor.
 */
export function proofHash(input: {
  bountyId: string;
  hunter: string;
  summary: string;
  links: string;
}): `0x${string}` {
  const canonical = [
    input.bountyId,
    input.hunter.toLowerCase(),
    input.summary.trim(),
    input.links.trim(),
  ].join("\n");
  return keccak256(stringToHex(canonical));
}
