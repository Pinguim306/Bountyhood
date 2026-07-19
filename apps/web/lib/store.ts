import { DISPUTE_WINDOW_SECS } from "./admin";
import { BountyStatus } from "./contract";
import { proofHash } from "./proof";
import { repo, usingDatabase } from "./repo";
import { SEED_BOUNTIES, SEED_REPORTS, SEED_SUBMISSIONS } from "./seed";
import type {
  Bounty,
  BountyMetadata,
  DisputeComment,
  ModerationEntry,
  Profile,
  Report,
  ReportReason,
  Submission,
} from "./types";

/**
 * Off-chain metadata store. Business rules live here; persistence is behind
 * the repo boundary (Postgres via DATABASE_URL, or JSON files for zero-config
 * dev — see lib/repo.ts).
 *
 * In preview mode (no deployed contract) this also holds bounty *state* so the
 * full create -> submit -> approve/dispute/reclaim flow is demoable
 * end-to-end. Once a contract is configured, on-chain state is the source of
 * truth and these writes become a thin metadata cache.
 *
 * Sample data only exists on the JSON backend: a real database starts empty.
 */
const seedBounties = usingDatabase ? [] : SEED_BOUNTIES;
const seedSubmissions = usingDatabase ? [] : SEED_SUBMISSIONS;
const seedReports = usingDatabase ? [] : SEED_REPORTS;

/* ------------------------------- bounties -------------------------------- */

/**
 * All bounties, newest first (seed + stored, stored overriding seed).
 * Moderation-hidden bounties are excluded by default so every listing surface
 * (grid, feed, leaderboard, profiles) drops them; pass includeHidden for admin
 * views and direct detail access — hiding is UI-only, the escrow still settles.
 */
export async function getBounties(opts?: {
  includeHidden?: boolean;
}): Promise<Bounty[]> {
  const stored = await repo.readBounties();
  const byId = new Map<string, Bounty>();
  for (const b of seedBounties) byId.set(b.id, b);
  for (const b of stored) byId.set(b.id, b);
  let rows = [...byId.values()];
  if (!opts?.includeHidden) {
    const hidden = new Set((await repo.readModeration()).map((m) => m.bountyId));
    if (hidden.size > 0) rows = rows.filter((b) => !hidden.has(b.id));
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getBounty(id: string): Promise<Bounty | undefined> {
  return (await getBounties({ includeHidden: true })).find((b) => b.id === id);
}

let draftCounter = 1000;

export async function createBounty(input: {
  metadata: Omit<BountyMetadata, "id" | "createdAt">;
  rewardWei: string;
  deadline: number;
}): Promise<Bounty> {
  const id = `local-${Date.now()}-${draftCounter++}`;
  const bounty: Bounty = {
    id,
    ...input.metadata,
    createdAt: Date.now(),
    rewardWei: input.rewardWei,
    deadline: input.deadline,
    status: BountyStatus.Open,
    submissionCount: 0,
  };
  await repo.upsertBounty(bounty);
  return bounty;
}

/** Mirror a chain-verified bounty (id = on-chain id, values from the chain). */
export async function registerOnChainBounty(input: {
  id: string;
  metadata: Omit<BountyMetadata, "id" | "createdAt">;
  rewardWei: string;
  deadline: number;
  txHash?: string;
}): Promise<Bounty> {
  const bounty: Bounty = {
    id: input.id,
    ...input.metadata,
    createdAt: Date.now(),
    rewardWei: input.rewardWei,
    deadline: input.deadline,
    status: BountyStatus.Open,
    submissionCount: 0,
    txHash: input.txHash,
  };
  await repo.upsertBounty(bounty);
  return bounty;
}

/* ------------------------------ submissions ------------------------------ */

/** Every submission across all bounties (seed + stored), newest first. */
export async function getAllSubmissions(): Promise<Submission[]> {
  const stored = await repo.readSubmissions();
  const byId = new Map<string, Submission>();
  for (const s of seedSubmissions) byId.set(s.id, s);
  for (const s of stored) byId.set(s.id, s); // stored overrides seed
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSubmissions(bountyId: string): Promise<Submission[]> {
  return (await getAllSubmissions()).filter((s) => s.bountyId === bountyId);
}

export async function addSubmission(input: {
  bountyId: string;
  hunter: string;
  summary: string;
  links: string;
}): Promise<Submission> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.status !== BountyStatus.Open) throw new Error("Bounty is not open");
  if (Math.floor(Date.now() / 1000) > bounty.deadline)
    throw new Error("Deadline has passed");
  if (input.hunter.toLowerCase() === bounty.creator.toLowerCase())
    throw new Error("Creators cannot submit to their own bounty");

  const submission: Submission = {
    id: `sub-${Date.now()}-${Math.floor(Date.now() % 100000)}`,
    bountyId: input.bountyId,
    hunter: input.hunter,
    summary: input.summary.trim(),
    links: input.links.trim(),
    proofHash: proofHash(input),
    createdAt: Date.now(),
    approved: false,
  };
  await repo.upsertSubmission(submission);

  // Count unique hunters, mirroring the contract's submissionCount.
  const hunters = new Set(
    (await getSubmissions(input.bountyId)).map((s) => s.hunter.toLowerCase())
  );
  await repo.upsertBounty({ ...bounty, submissionCount: hunters.size });
  return submission;
}

/* ----------------------------- creator actions --------------------------- */

export async function approveSubmission(input: {
  bountyId: string;
  submissionId: string;
  caller: string;
  payoutTxHash?: string;
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.creator.toLowerCase() !== input.caller.toLowerCase())
    throw new Error("Only the creator can approve");
  if (bounty.status !== BountyStatus.Open) throw new Error("Bounty is not open");

  const target = (await getSubmissions(input.bountyId)).find(
    (s) => s.id === input.submissionId
  );
  if (!target) throw new Error("Submission not found");

  // Mark the winning submission approved (seed rows get copied on write).
  await repo.upsertSubmission({ ...target, approved: true });

  const next: Bounty = {
    ...bounty,
    status: BountyStatus.Paid,
    winner: target.hunter,
    payoutTxHash: input.payoutTxHash ?? bounty.payoutTxHash,
  };
  await repo.upsertBounty(next);
  return next;
}

export async function cancelBounty(input: {
  bountyId: string;
  caller: string;
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.creator.toLowerCase() !== input.caller.toLowerCase())
    throw new Error("Only the creator can cancel");
  if (bounty.status !== BountyStatus.Open) throw new Error("Bounty is not open");
  if (bounty.submissionCount > 0)
    throw new Error("Cannot cancel once there are submissions");

  const next: Bounty = { ...bounty, status: BountyStatus.Cancelled };
  await repo.upsertBounty(next);
  return next;
}

export async function reclaimBounty(input: {
  bountyId: string;
  caller: string;
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.creator.toLowerCase() !== input.caller.toLowerCase())
    throw new Error("Only the creator can reclaim");
  if (bounty.status !== BountyStatus.Open) throw new Error("Bounty is not open");
  // Mirrors the contract: reclaim only after the dispute window elapses too.
  if (Math.floor(Date.now() / 1000) <= bounty.deadline + DISPUTE_WINDOW_SECS)
    throw new Error("Dispute window is still open");

  const next: Bounty = { ...bounty, status: BountyStatus.Reclaimed };
  await repo.upsertBounty(next);
  return next;
}

/* -------------------------------- disputes -------------------------------- */

/**
 * A hunter contests an expired bounty inside the dispute window so the creator
 * can't silently reclaim. Mirrors BountyEscrow.openDispute.
 */
export async function openDispute(input: {
  bountyId: string;
  caller: string;
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.status !== BountyStatus.Open) throw new Error("Bounty is not open");
  const subs = await getSubmissions(input.bountyId);
  const submitted = subs.some(
    (s) => s.hunter.toLowerCase() === input.caller.toLowerCase()
  );
  if (!submitted) throw new Error("Only hunters who submitted can dispute");
  const now = Math.floor(Date.now() / 1000);
  if (now <= bounty.deadline) throw new Error("Deadline has not passed yet");
  if (now > bounty.deadline + DISPUTE_WINDOW_SECS)
    throw new Error("Dispute window has closed");

  const next: Bounty = {
    ...bounty,
    status: BountyStatus.Disputed,
    disputedBy: input.caller,
  };
  await repo.upsertBounty(next);
  return next;
}

/**
 * Arbiter settles a dispute: approve a submission (pays that hunter) or refund
 * the creator (no winnerSubmissionId). Caller authorization (admin/arbiter) is
 * enforced at the API layer; this validates state transitions only.
 */
export async function resolveDispute(input: {
  bountyId: string;
  winnerSubmissionId: string | null;
  payoutTxHash?: string;
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.status !== BountyStatus.Disputed)
    throw new Error("Bounty is not disputed");

  if (!input.winnerSubmissionId) {
    const next: Bounty = {
      ...bounty,
      status: BountyStatus.Reclaimed,
      disputeOutcome: "creator",
    };
    await repo.upsertBounty(next);
    return next;
  }

  const target = (await getSubmissions(input.bountyId)).find(
    (s) => s.id === input.winnerSubmissionId
  );
  if (!target) throw new Error("Submission not found");

  await repo.upsertSubmission({ ...target, approved: true });

  const next: Bounty = {
    ...bounty,
    status: BountyStatus.Paid,
    winner: target.hunter,
    payoutTxHash: input.payoutTxHash ?? bounty.payoutTxHash,
    disputeOutcome: "hunter",
  };
  await repo.upsertBounty(next);
  return next;
}

/* ---------------------------- dispute evidence ---------------------------- */

export async function getDisputeComments(
  bountyId: string
): Promise<DisputeComment[]> {
  const rows = await repo.readDisputeComments(bountyId);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Post to a dispute's evidence thread. Only the bounty creator, hunters who
 * submitted, and moderators may write — and only while the dispute is open,
 * so the record the arbiter judged on stays frozen afterwards.
 */
export async function addDisputeComment(input: {
  bountyId: string;
  author: string;
  body: string;
  isModerator?: boolean;
}): Promise<DisputeComment> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.status !== BountyStatus.Disputed)
    throw new Error("The evidence thread is only open while disputed");

  const author = input.author.toLowerCase();
  const isCreator = bounty.creator.toLowerCase() === author;
  const isSubmitter = (await getSubmissions(input.bountyId)).some(
    (s) => s.hunter.toLowerCase() === author
  );
  if (!isCreator && !isSubmitter && !input.isModerator)
    throw new Error("Only the creator, submitters and moderators can post");

  const body = input.body.trim();
  if (!body) throw new Error("Write something first");
  if (body.length > 1000) throw new Error("Keep it under 1000 characters");

  const comment: DisputeComment = {
    id: `dc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    bountyId: input.bountyId,
    author,
    body,
    createdAt: Date.now(),
  };
  await repo.addDisputeComment(comment);
  return comment;
}

/* --------------------------------- reports -------------------------------- */

/** All reports, newest first (seed + stored, stored overriding seed). */
export async function getReports(): Promise<Report[]> {
  const stored = await repo.readReports();
  const byId = new Map<string, Report>();
  for (const r of seedReports) byId.set(r.id, r);
  for (const r of stored) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function addReport(input: {
  bountyId: string;
  reporter: string;
  reason: ReportReason;
  details: string;
}): Promise<Report> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  const existing = await getReports();
  const duplicate = existing.some(
    (r) =>
      r.bountyId === input.bountyId &&
      r.reporter.toLowerCase() === input.reporter.toLowerCase() &&
      r.status === "open"
  );
  if (duplicate) throw new Error("You already reported this bounty");

  const report: Report = {
    id: `report-${Date.now()}-${existing.length}`,
    bountyId: input.bountyId,
    reporter: input.reporter,
    reason: input.reason,
    details: input.details.trim().slice(0, 2000),
    createdAt: Date.now(),
    status: "open",
  };
  await repo.upsertReport(report);
  return report;
}

export async function setReportStatus(
  id: string,
  status: Report["status"]
): Promise<Report> {
  const target = (await getReports()).find((r) => r.id === id);
  if (!target) throw new Error("Report not found");
  const next: Report = { ...target, status };
  await repo.upsertReport(next); // seed reports get copied on write
  return next;
}

/* ------------------------------- moderation ------------------------------- */

export async function getModeration(): Promise<ModerationEntry[]> {
  return repo.readModeration();
}

export async function getModerationFor(
  bountyId: string
): Promise<ModerationEntry | undefined> {
  return (await getModeration()).find((m) => m.bountyId === bountyId);
}

/** Hide a bounty from all listing surfaces. UI-only — escrow rules still apply. */
export async function hideBounty(input: {
  bountyId: string;
  reason: string;
  moderator: string;
}): Promise<ModerationEntry> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  const entry: ModerationEntry = {
    bountyId: input.bountyId,
    reason: input.reason.trim() || "Violates content policy",
    moderator: input.moderator,
    hiddenAt: Date.now(),
  };
  await repo.upsertModeration(entry);
  return entry;
}

export async function unhideBounty(bountyId: string): Promise<void> {
  await repo.deleteModeration(bountyId);
}

/* -------------------------------- profiles -------------------------------- */

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9 _.\-]{1,30}[a-zA-Z0-9]$/;
const RESERVED_NAMES = new Set([
  "admin",
  "administrator",
  "arbiter",
  "moderator",
  "bountyhood",
  "official",
  "support",
  "system",
]);

export async function getProfile(
  address: string
): Promise<Profile | undefined> {
  const key = address.toLowerCase();
  try {
    return (await repo.readProfiles()).find((p) => p.address === key);
  } catch {
    // Degrade to "no profile" if the table doesn't exist yet (fresh DB before
    // `db:push`) — pages fall back to identicon + short address.
    return undefined;
  }
}

/**
 * Create/update the profile for a wallet. The caller address comes from a
 * verified SIWE session (see lib/auth.ts) — never from the request body.
 */
export async function updateProfile(input: {
  address: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  xHandle?: string;
}): Promise<Profile> {
  const address = input.address.toLowerCase();

  const name = input.name?.trim();
  if (name) {
    if (!NAME_RE.test(name))
      throw new Error(
        "Name must be 3-32 chars: letters, numbers, spaces, . _ -"
      );
    if (RESERVED_NAMES.has(name.toLowerCase().replace(/[\s_.\-]/g, "")))
      throw new Error("That name is reserved");
    const taken = (await repo.readProfiles()).some(
      (p) =>
        p.address !== address &&
        p.name?.toLowerCase() === name.toLowerCase()
    );
    if (taken) throw new Error("That name is already taken");
  }

  const bio = input.bio?.trim().slice(0, 280);

  const avatarUrl = input.avatarUrl?.trim();
  if (avatarUrl) {
    if (avatarUrl.startsWith("data:")) {
      // Uploaded photo, re-encoded client-side to a small square (see
      // ProfileEditor). Stored inline — no external image storage to run.
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl))
        throw new Error("Avatar upload must be a JPEG, PNG or WebP image");
      if (avatarUrl.length > 200_000)
        throw new Error("Avatar image is too large — try a smaller photo");
    } else {
      let url: URL;
      try {
        url = new URL(avatarUrl);
      } catch {
        throw new Error("Avatar must be a valid URL");
      }
      if (url.protocol !== "https:")
        throw new Error("Avatar URL must use https");
      if (avatarUrl.length > 500) throw new Error("Avatar URL is too long");
    }
  }

  const xHandle = input.xHandle?.trim().replace(/^@/, "");
  if (xHandle && !/^[A-Za-z0-9_]{1,15}$/.test(xHandle))
    throw new Error("Invalid X handle");

  const existing = await getProfile(address);
  const now = Date.now();
  const profile: Profile = {
    address,
    name: name || undefined,
    bio: bio || undefined,
    avatarUrl: avatarUrl || undefined,
    xHandle: xHandle || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await repo.upsertProfile(profile);
  return profile;
}
