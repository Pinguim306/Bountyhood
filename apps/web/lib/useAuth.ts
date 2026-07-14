"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { buildSignInMessage } from "./siwe-message";

/**
 * Wallet sign-in (SIWE-style). `session` is the address whose ownership was
 * proven by signature — distinct from `useAccount().address`, which is merely
 * the connected wallet. Profile writes require the former.
 */
export function useAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async (): Promise<string | null> => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return null;
      return (await res.json()).address ?? null;
    },
    staleTime: 60_000,
  });

  const signIn = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first");
    const { nonce } = await (await fetch("/api/auth/nonce")).json();
    const issuedAt = new Date().toISOString();
    const message = buildSignInMessage({
      domain: window.location.host,
      address,
      nonce,
      issuedAt,
    });
    const signature = await signMessageAsync({ message });
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, nonce, issuedAt, signature }),
    });
    if (!res.ok)
      throw new Error((await res.json()).error || "Sign-in failed");
    await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
  }, [address, signMessageAsync, queryClient]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
  }, [queryClient]);

  return {
    /** Signature-verified address (lowercase), or null. */
    session: session ?? null,
    isLoading,
    /** True when the connected wallet has a verified session. */
    isSignedIn:
      !!session && !!address && session === address.toLowerCase(),
    signIn,
    signOut,
  };
}
