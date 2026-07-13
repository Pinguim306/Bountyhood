import { BountyStatus } from "./contract";

/** Off-chain metadata for a bounty, keyed by its on-chain id once created. */
export interface BountyMetadata {
  id: string; // on-chain bounty id (string for JSON safety); "draft-*" before mint
  title: string;
  description: string;
  deliverables: string;
  category: string;
  creator: string; // wallet address
  createdAt: number; // unix ms
}

/** A bounty as shown in the UI = on-chain state + off-chain metadata. */
export interface Bounty extends BountyMetadata {
  rewardWei: string; // stringified bigint
  deadline: number; // unix seconds
  status: BountyStatus;
  submissionCount: number;
  winner?: string;
  txHash?: string;
}

/** A hunter's submission = off-chain proof anchored on-chain by hash. */
export interface Submission {
  id: string;
  bountyId: string;
  hunter: string; // wallet address
  summary: string;
  links: string; // newline-separated URLs
  proofHash: string; // keccak256 of the proof, matches on-chain anchor
  createdAt: number;
  approved: boolean;
}

export const CATEGORIES = [
  "Development",
  "Design",
  "Content",
  "Marketing",
  "Research",
  "Community",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
