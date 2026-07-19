import { createPublicClient, http } from "viem";
import { activeChain } from "./chains";
import {
  BOUNTY_ESCROW_ADDRESS,
  BountyStatus,
  bountyEscrowAbi,
  isContractConfigured,
} from "./contract";

/**
 * Server-side chain reads (Phase 6.6 hardening). When a contract is configured,
 * the API refuses to mirror money-related state it can't verify on-chain —
 * clients are never trusted about escrows.
 */

const client = isContractConfigured
  ? createPublicClient({ chain: activeChain, transport: http() })
  : null;

export interface OnChainBounty {
  creator: string;
  rewardWei: bigint;
  deadline: number;
  status: BountyStatus;
  winner: string;
  submissionCount: number;
}

/** True when the id looks like an on-chain bounty id (vs a preview "local-*"). */
export function isOnChainId(id: string): boolean {
  return /^[0-9]+$/.test(id);
}

export async function readBountyOnChain(
  id: string
): Promise<OnChainBounty | null> {
  if (!client || !isOnChainId(id)) return null;
  const b = await client.readContract({
    address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
    abi: bountyEscrowAbi,
    functionName: "getBounty",
    args: [BigInt(id)],
  });
  if (!b || b.creator === "0x0000000000000000000000000000000000000000")
    return null;
  return {
    creator: b.creator,
    rewardWei: b.reward,
    deadline: Number(b.deadline),
    status: Number(b.status) as BountyStatus,
    winner: b.winner,
    submissionCount: Number(b.submissionCount),
  };
}

export async function hasSubmittedOnChain(
  id: string,
  hunter: string
): Promise<boolean> {
  if (!client || !isOnChainId(id)) return false;
  return client.readContract({
    address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
    abi: bountyEscrowAbi,
    functionName: "hasSubmitted",
    args: [BigInt(id), hunter as `0x${string}`],
  });
}

/**
 * True when `hash` is a successful transaction sent to the escrow contract —
 * the sanity bar for storing it as a payment receipt. (The action's resulting
 * state is checked separately via readBountyOnChain.)
 */
export async function isEscrowTx(hash: string): Promise<boolean> {
  if (!client || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return false;
  try {
    const receipt = await client.getTransactionReceipt({
      hash: hash as `0x${string}`,
    });
    return (
      receipt.status === "success" &&
      receipt.to?.toLowerCase() ===
        (BOUNTY_ESCROW_ADDRESS as string).toLowerCase()
    );
  } catch {
    return false;
  }
}
