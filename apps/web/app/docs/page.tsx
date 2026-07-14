import Link from "next/link";
import { DISPUTE_WINDOW_SECS } from "@/lib/admin";
import { activeChain } from "@/lib/chains";
import {
  BOUNTY_ESCROW_ADDRESS,
  OFFICIAL_TOKEN_ADDRESS,
  isContractConfigured,
} from "@/lib/contract";

export const metadata = {
  title: "Docs — How Bountyhood works",
  description:
    "The mechanics of Bountyhood: escrowed bounties, submissions, payouts, disputes, fees and reputation on Robinhood Chain.",
};

const WINDOW_HOURS = DISPUTE_WINDOW_SECS / 3600;

/** How-it-works documentation (mechanics of the platform). */
export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-white">
        How Bountyhood works
      </h1>
      <p className="mt-3 text-zinc-400">
        Bountyhood is a non-custodial bounty platform. Money lives in a smart
        contract on {activeChain.name}; nobody — not even us — can move it
        outside the rules below.
      </p>

      {/* Lifecycle */}
      <Section title="The bounty lifecycle">
        <div className="overflow-x-auto">
          <pre className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 font-mono text-xs leading-relaxed text-zinc-300">
{`create (+ETH in escrow)
        │
        ▼
      OPEN ── hunters submit proof ──────────────┐
        │                                        │
        ├─ creator approves ──────► PAID         │  hunter gets reward − fee
        ├─ cancel (no submissions) ► CANCELLED   │  creator fully refunded
        └─ deadline passes                       │
              │                                  │
              ├─ ${String(WINDOW_HOURS)}h dispute window ──────────┘
              │      ├─ no dispute → creator reclaims → RECLAIMED
              │      └─ hunter disputes → DISPUTED
              │                              │
              │                   arbiter decides
              │                    ├─► PAID (hunter wins)
              │                    └─► RECLAIMED (creator refunded)`}
          </pre>
        </div>
      </Section>

      <Section title="1 · Creating a bounty">
        <p>
          You write a title, description, deliverables and deadline, then
          deposit the reward in ETH. The deposit goes straight into the{" "}
          <strong className="text-zinc-200">escrow contract</strong> — it locks
          the moment the bounty is published and cannot be withdrawn while the
          bounty is open.
        </p>
        <ul>
          <li>Minimum reward: 0.001 ETH (anti-spam floor).</li>
          <li>
            The platform fee rate is <strong className="text-zinc-200">frozen
            into your bounty at creation</strong>. Even if the global fee
            changes later, your bounty pays out at the rate you agreed to.
          </li>
          <li>
            You can cancel and get a full refund at any time —{" "}
            <em>as long as nobody has submitted work yet</em>. Once there is a
            submission, the escrow is committed until approval, expiry or
            dispute.
          </li>
        </ul>
      </Section>

      <Section title="2 · Hunting">
        <p>
          Anyone with a wallet (except the bounty&apos;s creator) can hunt.
          Complete the task, then submit a summary and proof links before the
          deadline. Each submission is anchored on-chain by a hash of its
          content, so nobody can quietly rewrite what was delivered.
        </p>
        <ul>
          <li>One active submission per wallet per bounty.</li>
          <li>Submissions close at the deadline.</li>
          <li>
            Submitting gives you standing to open a dispute later if the
            creator goes silent (see §5).
          </li>
        </ul>
      </Section>

      <Section title="3 · Approval & payout">
        <p>
          The creator reviews submissions and approves the winner. Approval is
          a single on-chain transaction: the escrow instantly pays the hunter{" "}
          <strong className="text-zinc-200">reward − platform fee</strong> and
          the bounty is marked <span className="text-lime">Paid</span>. There
          is no withdrawal step and no waiting period.
        </p>
      </Section>

      <Section title="4 · Expiry & reclaim">
        <p>
          If the deadline passes without an approval, the creator can reclaim
          the escrow — but only after the{" "}
          <strong className="text-zinc-200">{WINDOW_HOURS}-hour dispute
          window</strong> closes. The window exists so a creator can&apos;t
          silently take the money back while a hunter&apos;s valid work sits
          unreviewed.
        </p>
      </Section>

      <Section title="5 · Disputes">
        <p>
          During the dispute window, any hunter who submitted work can open a
          dispute. That freezes the escrow and hands the decision to the
          platform arbiter, who can only do one of two things:
        </p>
        <ul>
          <li>
            <strong className="text-zinc-200">Pay a hunter</strong> — must be
            someone who actually submitted; the normal fee applies; or
          </li>
          <li>
            <strong className="text-zinc-200">Refund the creator</strong> — the
            full reward returns, no fee.
          </li>
        </ul>
        <p>
          The arbiter cannot send funds anywhere else — the contract simply has
          no function for it.
        </p>
      </Section>

      <Section title="6 · Fees">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-zinc-500">
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 font-medium">Fee</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <Row a="Creating a bounty" b="Free (gas only)" />
              <Row a="Submitting work" b="Free (gas only)" />
              <Row a="Cancel / reclaim (refunds)" b="Never taxed — 100% back" />
              <Row a="Successful payout" b="2.5% of the reward, deducted from it" />
            </tbody>
          </table>
        </div>
        <p>
          The rate is capped at 10% by the contract itself and locked per
          bounty at creation — the platform earns only when work gets done.
        </p>
      </Section>

      <Section title="7 · Reputation">
        <p>
          Every wallet has a public{" "}
          <Link href="/leaderboard" className="text-lime hover:underline">
            profile
          </Link>{" "}
          built from on-platform activity: bounties won, total earned,
          submissions, bounties posted and paid out. The leaderboard ranks the
          top hunters by earnings and top creators by rewards funded. The{" "}
          <Link href="/activity" className="text-lime hover:underline">
            activity feed
          </Link>{" "}
          shows everything happening in real time.
        </p>
        <p>
          You can personalize your profile — display name, avatar, bio and X
          handle. Editing requires a one-time wallet signature (free, no
          transaction) proving you own the address, so nobody can impersonate
          you.
        </p>
      </Section>

      <Section title="8 · Moderation & safety">
        <p>
          Every bounty page has a report button. Moderators review reports and
          can hide bounties that break the{" "}
          <Link href="/terms" className="text-lime hover:underline">
            content policy
          </Link>
          . Hiding is <em>UI-only</em>: a hidden bounty disappears from
          listings, but its escrow still follows the contract&apos;s rules, so
          funds always settle for the people involved.
        </p>
      </Section>

      <Section title="9 · Contracts & addresses">
        <dl className="space-y-3 text-sm">
          <AddrRow
            label="Network"
            value={`${activeChain.name} (chain id ${activeChain.id})`}
          />
          {isContractConfigured && (
            <AddrRow label="Escrow contract" value={BOUNTY_ESCROW_ADDRESS} mono />
          )}
          <AddrRow label="Official token" value={OFFICIAL_TOKEN_ADDRESS} mono />
        </dl>
        <p>
          The escrow contract is verified on Blockscout — you can read every
          rule described above directly in the source code. Trust the code, not
          us.
        </p>
      </Section>

      <div className="mt-12 rounded-2xl border border-lime/30 bg-lime/[0.06] p-6 text-center">
        <p className="text-sm text-zinc-300">Ready to try it?</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Link
            href="/create"
            className="rounded-xl bg-lime px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-lime-bright"
          >
            Post a bounty
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-ink-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-ink-800"
          >
            Browse bounties
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-400 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function Row({ a, b }: { a: string; b: string }) {
  return (
    <tr className="border-b border-ink-800/60">
      <td className="py-2 pr-4">{a}</td>
      <td className="py-2">{b}</td>
    </tr>
  );
}

function AddrRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-36 shrink-0 text-zinc-500">{label}</dt>
      <dd className={`break-all text-zinc-300 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
