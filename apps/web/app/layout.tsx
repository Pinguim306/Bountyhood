import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { OFFICIAL_TOKEN_ADDRESS } from "@/lib/contract";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://bountyhood-web.vercel.app"
  ),
  title: "Bountyhood — on-chain bounties on Robinhood Chain",
  description:
    "Create bounties with escrowed rewards. Complete tasks, submit proof, get paid on-chain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="mx-auto max-w-6xl space-y-2 px-4 py-12 text-sm text-zinc-600">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Bountyhood · built on Robinhood Chain · rewards settle in ETH</span>
              <span className="flex items-center gap-4">
                <a
                  href="https://x.com/bountyhoodfun"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-zinc-400"
                >
                  Follow on 𝕏
                </a>
                <Link href="/terms" className="transition hover:text-zinc-400">
                  Terms &amp; content policy
                </Link>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500">Official token:</span>
              <span className="break-all font-mono text-zinc-400">
                {OFFICIAL_TOKEN_ADDRESS}
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
