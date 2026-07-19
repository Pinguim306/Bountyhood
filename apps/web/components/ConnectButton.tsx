"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chains";
import { shortAddress } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";

/**
 * Wallet connect with a mobile-friendly strategy:
 * 1. Injected provider present (extension or a wallet's in-app browser) →
 *    connect directly.
 * 2. Else, WalletConnect configured → open its modal (QR on desktop,
 *    wallet-app deep links on mobile).
 * 3. Else → a small panel with deep links that reopen this site inside
 *    MetaMask / Coinbase Wallet's built-in browser, where an injected
 *    provider exists. Regular mobile browsers have no extension, so a bare
 *    injected connect silently does nothing — the old behavior users hit.
 */
export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: profile } = useProfile(isConnected ? address : undefined);

  const [hasInjected, setHasInjected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasInjected(
      typeof window !== "undefined" &&
        !!(window as { ethereum?: unknown }).ethereum
    );
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    const close = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [panelOpen]);

  if (!isConnected) {
    const injected = connectors.find((c) => c.type === "injected");
    const walletConnect = connectors.find((c) => c.id === "walletConnect");

    const onClick = () => {
      if (hasInjected && injected) {
        connect({ connector: injected });
      } else if (walletConnect) {
        connect({ connector: walletConnect }); // QR / mobile deep links
      } else {
        setPanelOpen((v) => !v);
      }
    };

    const dappPath =
      typeof window !== "undefined"
        ? `${window.location.host}${window.location.pathname}`
        : "bountyhood.fun";

    return (
      <div className="relative" ref={panelRef}>
        <button
          onClick={onClick}
          disabled={isPending}
          className="rounded-xl bg-lime px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-lime-bright disabled:opacity-50"
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>

        {panelOpen && (
          <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-ink-700 bg-ink-900 p-3 shadow-xl shadow-black/40">
            <div className="px-1 pb-2 text-xs text-zinc-500">
              No wallet detected in this browser. Open Bountyhood inside your
              wallet app:
            </div>
            <a
              href={`https://metamask.app.link/dapp/${dappPath}`}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-ink-800 hover:text-lime"
            >
              🦊 Open in MetaMask
            </a>
            <a
              href={`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(
                typeof window !== "undefined"
                  ? window.location.href
                  : "https://bountyhood.fun"
              )}`}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-ink-800 hover:text-lime"
            >
              🔵 Open in Coinbase Wallet
            </a>
            <div className="mt-1 border-t border-ink-800 px-1 pt-2 text-xs text-zinc-600">
              Using another wallet? Open its built-in browser and visit{" "}
              <span className="text-zinc-400">bountyhood.fun</span>. On desktop,
              install the MetaMask extension.
            </div>
          </div>
        )}
      </div>
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
