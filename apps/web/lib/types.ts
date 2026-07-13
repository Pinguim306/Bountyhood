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
