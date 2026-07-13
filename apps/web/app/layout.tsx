import type { Metadata } from "next";
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
          <footer className="mx-auto max-w-6xl px-4 py-12 text-sm text-zinc-600">
            Bountyhood · built on Robinhood Chain · rewards settle in ETH
          </footer>
        </Providers>
      </body>
    </html>
  );
}
