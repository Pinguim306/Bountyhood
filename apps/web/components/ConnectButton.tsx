"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chains";
import { shortAddress } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: profile } = useProfile(isConnected ? address : undefined);

  if (!isConnected) {
    const injected = connectors[0];
    return (
      <button
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending || !injected}
        className="rounded-xl bg-lime px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-lime-bright disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const wrongChain = chainId !== activeChain.id;
  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: activeChain.id })}
        className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/20"
      >
        Switch to {activeChain.name}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Link
        href={`/profile/${address}`}
        className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-lime/40 hover:bg-ink-700"
        title="My profile"
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-lime align-middle" />
        {profile?.name ?? shortAddress(address)}
      </Link>
      <button
        onClick={() => disconnect()}
        className="rounded-xl border border-ink-700 px-2.5 py-2 text-sm text-zinc-500 transition hover:border-ink-600 hover:text-zinc-300"
        title="Disconnect"
        aria-label="Disconnect wallet"
      >
        ⏻
      </button>
    </span>
  );
}
