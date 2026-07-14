import { bountyEscrowAbi } from "./abi/BountyEscrow";

export { bountyEscrowAbi };

/**
 * Deployed BountyEscrow address for the active chain. Set once the contract is
 * deployed (see packages/contracts). Empty until then — the UI degrades to a
 * read-only preview using the local metadata store.
 */
export const BOUNTY_ESCROW_ADDRESS = (process.env
  .NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS ?? "") as `0x${string}` | "";

export const isContractConfigured = BOUNTY_ESCROW_ADDRESS.length === 42;

/**
 * Official Bountyhood token contract. Displayed across the site as an
 * anti-impersonation reference — anything else claiming to be the Bountyhood
 * token is not ours.
 */
export const OFFICIAL_TOKEN_ADDRESS =
  "0x4fb665cb45c6903b55e31cdf77fd8e65a65bd236";

/** On-chain status enum, mirrored from BountyEscrow.sol. */
export enum BountyStatus {
  Open = 0,
  Paid = 1,
  Cancelled = 2,
  Reclaimed = 3,
  Disputed = 4,
}
