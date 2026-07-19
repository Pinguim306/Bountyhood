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
 * Official Bountyhood token address, set via NEXT_PUBLIC_OFFICIAL_TOKEN_ADDRESS.
 * Empty until configured — the site simply omits the "Official token" line
 * everywhere until a value is set (then it appears automatically).
 */
export const OFFICIAL_TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_OFFICIAL_TOKEN_ADDRESS ?? ""
).trim();

export const hasOfficialToken = /^0x[a-fA-F0-9]{40}$/.test(
  OFFICIAL_TOKEN_ADDRESS
);

/** On-chain status enum, mirrored from BountyEscrow.sol. */
export enum BountyStatus {
  Open = 0,
  Paid = 1,
  Cancelled = 2,
  Reclaimed = 3,
  Disputed = 4,
}
