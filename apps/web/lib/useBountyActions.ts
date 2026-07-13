"use client";

import { useCallback } from "react";
import { useWriteContract } from "wagmi";
import {
  BOUNTY_ESCROW_ADDRESS,
  bountyEscrowAbi,
  isContractConfigured,
} from "./contract";
import { proofHash } from "./proof";

/**
 * Bridges preview mode (JSON store via the API) and live mode (on-chain writes).
 * Consumers call the same methods; the hook routes to the right backend.
 */
export function useBountyActions() {
  const { writeContractAsync } = useWriteContract();

  const onChain = useCallback(
    (functionName: string, args: unknown[]) =>
      writeContractAsync({
        address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
        abi: bountyEscrowAbi,
        functionName: functionName as never,
        args: args as never,
      }),
    [writeContractAsync]
  );

  const submit = useCallback(
    async (bountyId: string, hunter: string, summary: string, links: string) => {
      // Always persist the proof off-chain so it's retrievable by its hash.
      const res = await fetch(`/api/bounties/${bountyId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hunter, summary, links }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      if (isContractConfigured) {
        const hash = proofHash({ bountyId, hunter, summary, links });
        await onChain("submit", [BigInt(bountyId), hash]);
      }
      return data;
    },
    [onChain]
  );

  const approve = useCallback(
    async (bountyId: string, caller: string, submissionId: string, hunter: string) => {
      if (isContractConfigured) {
        await onChain("approve", [BigInt(bountyId), hunter]);
      }
      const res = await fetch(`/api/bounties/${bountyId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", caller, submissionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      return data;
    },
    [onChain]
  );

  const lifecycle = useCallback(
    async (action: "cancel" | "reclaim", bountyId: string, caller: string) => {
      if (isContractConfigured) {
        await onChain(action, [BigInt(bountyId)]);
      }
      const res = await fetch(`/api/bounties/${bountyId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, caller }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      return data;
    },
    [onChain]
  );

  return { submit, approve, lifecycle };
}
