import { formatEther } from "viem";
import { BountyStatus } from "./contract";

export function formatReward(wei: string): string {
  const eth = formatEther(BigInt(wei));
  const n = Number(eth);
  if (n >= 1) return `${n.toFixed(2)} ETH`;
  if (n >= 0.001) return `${n.toFixed(3)} ETH`;
  return `${eth} ETH`;
}

export function shortAddress(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Human countdown to a unix-seconds deadline. */
export function timeLeft(deadline: number): { label: string; ended: boolean } {
  const secs = deadline - Math.floor(Date.now() / 1000);
  if (secs <= 0) return { label: "Ended", ended: true };
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return { label: `${d}d ${h}h left`, ended: false };
  if (h > 0) return { label: `${h}h ${m}m left`, ended: false };
  return { label: `${m}m left`, ended: false };
}

/** Compact "2h ago" style relative time from a unix-ms timestamp. */
export function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return "just now";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export const STATUS_META: Record<
  BountyStatus,
  { label: string; tone: string }
> = {
  [BountyStatus.Open]: { label: "Open", tone: "text-lime border-lime/40 bg-lime/10" },
  [BountyStatus.Paid]: {
    label: "Paid out",
    tone: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  },
  [BountyStatus.Cancelled]: {
    label: "Cancelled",
    tone: "text-zinc-400 border-zinc-500/40 bg-zinc-500/10",
  },
  [BountyStatus.Reclaimed]: {
    label: "Expired",
    tone: "text-zinc-400 border-zinc-500/40 bg-zinc-500/10",
  },
  [BountyStatus.Disputed]: {
    label: "Disputed",
    tone: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  },
};
