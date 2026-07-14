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
  disputedBy?: string; // hunter who opened the dispute, while Disputed
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

/** A user report flagging a bounty for moderation (Phase 5). Off-chain only. */
export interface Report {
  id: string;
  bountyId: string;
  reporter: string; // wallet address
  reason: ReportReason;
  details: string;
  createdAt: number; // unix ms
  status: "open" | "dismissed" | "actioned";
}

export const REPORT_REASONS = [
  "Illegal activity",
  "Violence or harassment",
  "Scam or fraud",
  "Spam or misleading",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * A moderation action hiding a bounty from listings. UI-only: the escrow keeps
 * following the contract's rules, so creator/hunters can still settle funds.
 */
export interface ModerationEntry {
  bountyId: string;
  reason: string;
  moderator: string; // admin wallet address
  hiddenAt: number; // unix ms
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
