import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
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
          <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-12 text-sm text-zinc-600">
            <span>Bountyhood · built on Robinhood Chain · rewards settle in ETH</span>
            <Link
              href="/terms"
              className="transition hover:text-zinc-400"
            >
              Terms & content policy
            </Link>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
