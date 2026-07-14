import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { LogoMark } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-800/80 bg-ink-950/70 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={32} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              Bounty<span className="text-lime">hood</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
            <Link href="/" className="transition hover:text-white">
              Bounties
            </Link>
            <Link href="/leaderboard" className="transition hover:text-white">
              Leaderboard
            </Link>
            <Link href="/activity" className="transition hover:text-white">
              Activity
            </Link>
            <Link href="/docs" className="transition hover:text-white">
              Docs
            </Link>
            <Link href="/create" className="transition hover:text-white">
              Create
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="hidden rounded-xl border border-lime/40 bg-lime/10 px-4 py-2 text-sm font-semibold text-lime transition hover:bg-lime/20 sm:block"
          >
            + New bounty
          </Link>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
