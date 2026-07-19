"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import type { AppNotification } from "@/lib/notifications";

/**
 * Header bell: polls /api/notifications for the connected wallet and badges
 * anything not yet opened. "Seen" lives in localStorage — the server derives
 * notifications from public state and keeps no per-user read flags.
 */

const SEEN_KEY = "bh-seen-notifications";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function NotificationsBell() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSeen(readSeen()), []);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", address?.toLowerCase()],
    enabled: isConnected && !!address,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<AppNotification[]> => {
      const res = await fetch(`/api/notifications?address=${address}`);
      if (!res.ok) return [];
      return (await res.json()) as AppNotification[];
    },
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!isConnected || !address) return null;

  const unseen = notifications.filter((n) => !seen.has(n.id));
  const hasUrgent = unseen.some((n) => n.urgent);

  const markAllSeen = () => {
    const next = new Set(seen);
    for (const n of notifications) next.add(n.id);
    setSeen(next);
    // Cap stored ids so the list can't grow without bound.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-200)));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllSeen();
        }}
        aria-label="Notifications"
        className="relative rounded-xl border border-ink-800 bg-ink-900 p-2 text-zinc-400 transition hover:text-white"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unseen.length > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-ink-950 ${
              hasUrgent ? "bg-red-400" : "bg-lime"
            }`}
          >
            {unseen.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl">
          <div className="border-b border-ink-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              Nothing needs your attention.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink-800/60 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition hover:bg-ink-800/50"
                  >
                    <p
                      className={`text-sm font-semibold ${
                        n.urgent ? "text-red-300" : "text-zinc-200"
                      }`}
                    >
                      {n.urgent && "⚠ "}
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {n.body}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
