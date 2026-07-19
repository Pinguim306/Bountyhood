import Link from "next/link";

export const metadata = {
  title: "Terms & content policy — Bountyhood",
};

/**
 * Terms of use and content policy (Phase 5). Lesson learned from pump.fun GO's
 * launch backlash: bounties are user-generated content with money attached, so
 * the rules ship with the MVP, not after.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Terms of use & content policy
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: July 2026</p>

      <div className="prose-invert mt-8 space-y-8 text-zinc-300">
        <Section title="1. What Bountyhood is">
          <p>
            Bountyhood is a non-custodial bounty platform on Robinhood Chain.
            Rewards are locked in the <code>BountyEscrow</code> smart contract
            when a bounty is created and released by that contract&apos;s rules:
            the creator approves a submission, reclaims after the deadline and
            dispute window, or the platform arbiter settles an open dispute.
            Bountyhood never takes custody of your funds and cannot move escrow
            outside those rules.
          </p>
        </Section>

        <Section title="2. Your responsibilities">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              You are responsible for the content of bounties you post and the
              work you submit, and for complying with the laws that apply to
              you.
            </li>
            <li>
              Wallet transactions are irreversible. Double-check amounts,
              deadlines, and addresses before signing.
            </li>
            <li>
              Creators must review submissions in good faith. Hunters must
              submit genuine work with verifiable proof.
            </li>
          </ul>
        </Section>

        <Section title="3. Content policy — what gets removed">
          <p>Bounties that involve any of the following are hidden from the platform:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Illegal activity, or soliciting it — anywhere, in any form.</li>
            <li>
              Violence, threats, harassment, doxxing, or targeting of any person
              or group.
            </li>
            <li>Scams, fraud, market manipulation, or deceptive schemes.</li>
            <li>Sexual content involving minors — reported to authorities.</li>
            <li>Spam, engagement farming, or deliberately unverifiable tasks.</li>
          </ul>
          <p className="mt-3">
            Moderation hides a bounty from listings only. Because escrow is
            enforced by the contract, funds in a hidden bounty still settle by
            the contract&apos;s rules — a hidden bounty&apos;s creator can still
            cancel or reclaim, and its hunters can still be paid.
          </p>
        </Section>

        <Section title="4. Reporting and enforcement">
          <p>
            Every bounty page has a report button. Reports go to the moderation
            queue and are reviewed by platform moderators, who may hide the
            bounty and, for repeated or severe violations, hide all bounties
            from an address. If you believe a moderation action was a mistake,
            contact us and we will review it.
          </p>
        </Section>

        <Section title="5. Disputes">
          <p>
            If a bounty expires without approval, hunters who submitted work can
            open a dispute during the 72-hour window after the deadline. A
            dispute freezes the escrow until the platform arbiter either pays a
            hunter or refunds the creator. The arbiter&apos;s decision is
            enforced on-chain and is final.
          </p>
          <p>
            While a dispute is open, both parties may post to the public
            evidence thread on the bounty page; the thread freezes at
            resolution. The arbiter targets a ruling within 72 hours of a
            dispute opening, though this is a service goal, not a contractual
            deadline. A ruling in the hunter&apos;s favour is recorded on the
            creator&apos;s public profile as a lost dispute.
          </p>
        </Section>

        <Section title="6. Fees">
          <p>
            The platform charges a small fee (capped at 5% by the contract) on
            successful payouts. The fee is deducted from the reward at payout —
            never added on top.
          </p>
        </Section>

        <Section title="7. No warranties">
          <p>
            Bountyhood is provided as-is. We do not guarantee the quality of
            work, the conduct of counterparties, or uninterrupted operation of
            the chain. Smart contracts carry inherent risk — use the platform at
            your own discretion.
          </p>
        </Section>
      </div>

      <div className="mt-10 border-t border-ink-800 pt-6 text-sm text-zinc-500">
        Questions? Reach the moderators via the{" "}
        <Link href="/" className="text-zinc-300 underline underline-offset-2">
          community channels
        </Link>
        .
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
    <section>
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
