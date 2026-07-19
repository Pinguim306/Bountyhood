"use client";

import { useCallback } from "react";
import { parseEther, parseEventLogs } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import {
  BOUNTY_ESCROW_ADDRESS,
  bountyEscrowAbi,
  isContractConfigured,
} from "./contract";
import { proofHash } from "./proof";
import { useAuth } from "./useAuth";

/**
 * Bridges preview mode (JSON/DB store via the API) and live mode (on-chain
 * writes mirrored by the API after server-side chain verification).
 *
 * Every API write requires a SIWE session — `ensureSession` transparently asks
 * the wallet for the one-time sign-in signature when needed. In live mode the
 * on-chain transaction always runs (and is mined) BEFORE the API call, because
 * the server refuses to record state it can't confirm on-chain.
 */
export function useBountyActions() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { isSignedIn, signIn } = useAuth();

  const ensureSession = useCallback(async () => {
    if (!isSignedIn) await signIn();
  }, [isSignedIn, signIn]);

  /** Send a contract write and wait until it's mined; returns the receipt. */
  const onChain = useCallback(
    async (functionName: string, args: unknown[], value?: bigint) => {
      const hash = await writeContractAsync({
        address: BOUNTY_ESCROW_ADDRESS as `0x${string}`,
        abi: bountyEscrowAbi,
        functionName: functionName as never,
        args: args as never,
        value: value as never,
      });
      if (!publicClient) throw new Error("No RPC client");
      return publicClient.waitForTransactionReceipt({ hash });
    },
    [writeContractAsync, publicClient]
  );

  /**
   * Create a bounty. Live mode: escrow the reward on-chain first, then
   * register the metadata under the on-chain id. Preview: API only.
   */
  const create = useCallback(
    async (input: {
      title: string;
      description: string;
      deliverables: string;
      category: string;
      rewardEth: string;
      deadline: number; // unix seconds
    }) => {
      await ensureSession();

      let id: string | undefined;
      let txHash: string | undefined;
      if (isContractConfigured) {
        const metadataHash = proofHash({
          bountyId: "create",
          hunter: "0x0",
          summary: `${input.title}\n${input.description}`,
          links: input.deliverables,
        });
        const receipt = await onChain(
          "createBounty",
          [BigInt(input.deadline), metadataHash],
          parseEther(input.rewardEth)
        );
        const [created] = parseEventLogs({
          abi: bountyEscrowAbi,
          logs: receipt.logs,
          eventName: "BountyCreated",
        });
        id = created.args.id.toString();
        txHash = receipt.transactionHash;
      }

      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, id, txHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create bounty");
      return data;
    },
    [ensureSession, onChain]
  );

  const submit = useCallback(
    async (bountyId: string, hunter: string, summary: string, links: string) => {
      await ensureSession();
      // Live mode: anchor the proof on-chain first — the API verifies it.
      if (isContractConfigured) {
        const hash = proofHash({ bountyId, hunter, summary, links });
        await onChain("submit", [BigInt(bountyId), hash]);
      }
      const res = await fetch(`/api/bounties/${bountyId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary, links }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      return data;
    },
    [ensureSession, onChain]
  );

  const mirror = useCallback(
    async (bountyId: string, payload: Record<string, string>) => {
      const res = await fetch(`/api/bounties/${bountyId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      return data;
    },
    []
  );

  const approve = useCallback(
    async (bountyId: string, _caller: string, submissionId: string, hunter: string) => {
      await ensureSession();
      let payoutTxHash: string | undefined;
      if (isContractConfigured) {
        const receipt = await onChain("approve", [BigInt(bountyId), hunter]);
        payoutTxHash = receipt.transactionHash;
      }
      return mirror(bountyId, {
        action: "approve",
        submissionId,
        ...(payoutTxHash ? { payoutTxHash } : {}),
      });
    },
    [ensureSession, onChain, mirror]
  );

  const lifecycle = useCallback(
    async (action: "cancel" | "reclaim", bountyId: string, _caller: string) => {
      await ensureSession();
      if (isContractConfigured) {
        await onChain(action, [BigInt(bountyId)]);
      }
      return mirror(bountyId, { action });
    },
    [ensureSession, onChain, mirror]
  );

  const dispute = useCallback(
    async (bountyId: string, _caller: string) => {
      await ensureSession();
      if (isContractConfigured) {
        await onChain("openDispute", [BigInt(bountyId)]);
      }
      return mirror(bountyId, { action: "dispute" });
    },
    [ensureSession, onChain, mirror]
  );

  /** Arbiter settles a dispute; null submission refunds the creator. */
  const resolve = useCallback(
    async (
      bountyId: string,
      _caller: string,
      submissionId: string | null,
      hunter: string | null
    ) => {
      await ensureSession();
      let payoutTxHash: string | undefined;
      if (isContractConfigured) {
        const winner = hunter ?? "0x0000000000000000000000000000000000000000";
        const receipt = await onChain("resolveDispute", [BigInt(bountyId), winner]);
        if (hunter) payoutTxHash = receipt.transactionHash;
      }
      return mirror(bountyId, {
        action: "resolve",
        submissionId: submissionId ?? "",
        ...(payoutTxHash ? { payoutTxHash } : {}),
      });
    },
    [ensureSession, onChain, mirror]
  );

  /** Flag a bounty for moderation. Off-chain only. */
  const report = useCallback(
    async (bountyId: string, _reporter: string, reason: string, details: string) => {
      await ensureSession();
      const res = await fetch(`/api/bounties/${bountyId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to report");
      return data;
    },
    [ensureSession]
  );

  return { create, submit, approve, lifecycle, dispute, resolve, report };
}
