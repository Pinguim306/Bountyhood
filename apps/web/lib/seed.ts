import { BountyStatus } from "./contract";
import type { Bounty, Report, Submission } from "./types";

const now = Math.floor(Date.now() / 1000);
const days = (n: number) => n * 24 * 60 * 60;
const eth = (n: number) => (BigInt(Math.round(n * 1e6)) * 10n ** 12n).toString();

/**
 * Sample bounties so the UI renders before a contract is deployed. In preview
 * mode (no NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS) these are shown alongside anything
 * created through the form. Phase 3 replaces this with the on-chain indexer.
 */
export const SEED_BOUNTIES: Bounty[] = [
  {
    id: "1",
    title: "Build a Robinhood Chain block explorer widget",
    description:
      "Create an embeddable React widget that shows the latest blocks and gas price on Robinhood Chain. Must be self-contained and themeable.",
    deliverables:
      "GitHub repo (MIT) + live demo URL. Widget must work with our RPC and refresh every block.",
    category: "Development",
    creator: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    createdAt: Date.now() - days(1) * 1000,
    rewardWei: eth(0.5),
    deadline: now + days(5),
    status: BountyStatus.Open,
    submissionCount: 7,
  },
  {
    id: "2",
    title: "Design the Bountyhood mascot",
    description:
      "We need a memorable mascot for Bountyhood — playful, on-brand with the lime/dark aesthetic. Vector art, a few poses.",
    deliverables: "SVG + PNG exports, 3 poses, brand-safe license transfer.",
    category: "Design",
    creator: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    createdAt: Date.now() - days(2) * 1000,
    rewardWei: eth(0.25),
    deadline: now + days(2),
    status: BountyStatus.Open,
    submissionCount: 21,
  },
  {
    id: "3",
    title: "Write a getting-started guide for deploying on Robinhood Chain",
    description:
      "A clear, beginner-friendly tutorial: connect wallet, get testnet ETH, deploy a contract with Hardhat, verify on Blockscout.",
    deliverables: "Markdown article, tested commands, screenshots.",
    category: "Content",
    creator: "0x28C6c06298d514Db089934071355E5743bf21d60",
    createdAt: Date.now() - days(6) * 1000,
    rewardWei: eth(0.15),
    deadline: now - days(1),
    status: BountyStatus.Paid,
    submissionCount: 12,
    winner: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
  },
  {
    id: "4",
    title: "Find and report a bug in our escrow contract",
    description:
      "Responsible disclosure bounty. Reproduce any correctness or fund-safety issue in BountyEscrow.sol on testnet.",
    deliverables: "Written report + PoC test that fails against the contract.",
    category: "Research",
    creator: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    createdAt: Date.now() - days(3) * 1000,
    rewardWei: eth(1.0),
    deadline: now + days(10),
    status: BountyStatus.Open,
    submissionCount: 3,
  },
  {
    id: "5",
    title: "Grow the Bountyhood Discord to 1,000 members",
    description:
      "Organic growth only — no bots. Bring real, engaged members interested in on-chain bounties.",
    deliverables: "Before/after member counts + summary of what you did.",
    category: "Community",
    creator: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    createdAt: Date.now() - days(4) * 1000,
    rewardWei: eth(0.35),
    deadline: now + days(1),
    status: BountyStatus.Open,
    submissionCount: 9,
  },
  {
    id: "6",
    title: "Create a viral meme campaign for #Bountyhood",
    description:
      "Ship a set of memes that get real traction on X. Quality and reach both count.",
    deliverables: "Links to posts with >10k impressions total.",
    category: "Marketing",
    creator: "0x28C6c06298d514Db089934071355E5743bf21d60",
    createdAt: Date.now() - days(8) * 1000,
    rewardWei: eth(0.2),
    deadline: now - days(3),
    status: BountyStatus.Reclaimed,
    submissionCount: 4,
  },
  {
    id: "7",
    title: "Translate the Bountyhood docs to Spanish",
    description:
      "Full translation of the README and user guide. Native-level fluency required; keep code blocks and terminology intact.",
    deliverables: "Markdown files in a PR against our docs repo.",
    category: "Content",
    creator: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    createdAt: Date.now() - days(9) * 1000,
    rewardWei: eth(0.12),
    deadline: now - days(1),
    status: BountyStatus.Disputed,
    submissionCount: 1,
    disputedBy: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
  },
];

/** Sample submissions so the submission list renders in preview mode. */
export const SEED_SUBMISSIONS: Submission[] = [
  {
    id: "seed-sub-1",
    bountyId: "1",
    hunter: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    summary:
      "Shipped an embeddable React widget with live blocks + gas. Themeable via CSS variables, refreshes on every new block over your RPC.",
    links: "https://github.com/example/rh-explorer-widget\nhttps://widget.example.dev",
    proofHash:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    createdAt: Date.now() - 12 * 60 * 60 * 1000,
    approved: false,
  },
  {
    id: "seed-sub-2",
    bountyId: "1",
    hunter: "0x28C6c06298d514Db089934071355E5743bf21d60",
    summary:
      "Alternative implementation using web components so it drops into any framework. Includes a Storybook and dark/light themes.",
    links: "https://github.com/example/rh-blocks-wc",
    proofHash:
      "0x0000000000000000000000000000000000000000000000000000000000000002",
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    approved: false,
  },
  {
    id: "seed-sub-3",
    bountyId: "4",
    hunter: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    summary:
      "Reviewed BountyEscrow.sol — no fund-safety issues found, but suggested tightening the dispute-window boundary check. Full write-up attached.",
    links: "https://gist.github.com/example/escrow-review",
    proofHash:
      "0x0000000000000000000000000000000000000000000000000000000000000003",
    createdAt: Date.now() - 20 * 60 * 60 * 1000,
    approved: false,
  },
  {
    id: "seed-sub-4",
    bountyId: "7",
    hunter: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    summary:
      "Complete Spanish translation delivered before the deadline — README plus the full user guide, terminology glossary included. Creator went quiet, so I opened a dispute.",
    links: "https://github.com/example/bountyhood-docs-es/pull/1",
    proofHash:
      "0x0000000000000000000000000000000000000000000000000000000000000004",
    createdAt: Date.now() - days(2) * 1000,
    approved: false,
  },
];

/** Sample open report so the moderation queue renders in preview mode. */
export const SEED_REPORTS: Report[] = [
  {
    id: "seed-report-1",
    bountyId: "6",
    reporter: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    reason: "Spam or misleading",
    details:
      "Impressions in the acceptance criteria can't be verified — looks like engagement farming.",
    createdAt: Date.now() - days(1) * 1000,
    status: "open",
  },
];
