import { promises as fs } from "fs";
import path from "path";
import { DISPUTE_WINDOW_SECS } from "./admin";
import { BountyStatus } from "./contract";
import { proofHash } from "./proof";
import { SEED_BOUNTIES, SEED_REPORTS, SEED_SUBMISSIONS } from "./seed";
import type {
  Bounty,
  BountyMetadata,
  ModerationEntry,
  Report,
  ReportReason,
  Submission,
} from "./types";

/**
 * MVP metadata store backed by JSON files. Stands in for Postgres + the on-chain
 * indexer (Phase 3). Server-only.
 *
 * In preview mode (no deployed contract) it also holds bounty *state* so the
 * full create -> submit -> approve/reclaim flow is demoable end-to-end. Once a
 * contract is configured, on-chain state is the source of truth and these writes
 * become a thin metadata cache.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const BOUNTIES_FILE = path.join(DATA_DIR, "bounties.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const MODERATION_FILE = path.join(DATA_DIR, "moderation.json");

async function readJson<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

async function writeJson<T>(file: string, rows: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2));
}

/* ------------------------------- bounties -------------------------------- */

/**
 * All bounties, newest first (seed + user-created, stored overriding seed).
 * Moderation-hidden bounties are excluded by default so every listing surface
 * (grid, feed, leaderboard, profiles) drops them; pass includeHidden for admin
 * views and direct detail access — hiding is UI-only, the escrow still settles.
 */
export async function getBounties(opts?: {
  includeHidden?: boolean;
}): Promise<Bounty[]> {
  const stored = await readJson<Bounty>(BOUNTIES_FILE);
  const byId = new Map<string, Bounty>();
  for (const b of SEED_BOUNTIES) byId.set(b.id, b);
  for (const b of stored) byId.set(b.id, b);
  let rows = [...byId.values()];
  if (!opts?.includeHidden) {
    const hidden = await getHiddenIds();
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
  const stored = await readJson<Bounty>(BOUNTIES_FILE);
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
  stored.push(bounty);
  await writeJson(BOUNTIES_FILE, stored);
  return bounty;
}

/**
 * Persist a mutated bounty (status/winner/count). Seed bounties are copied into
 * the store on first write so their state can change in preview mode.
 */
async function saveBountyState(next: Bounty): Promise<void> {
  const stored = await readJson<Bounty>(BOUNTIES_FILE);
  const idx = stored.findIndex((b) => b.id === next.id);
  if (idx >= 0) stored[idx] = next;
  else stored.push(next);
  await writeJson(BOUNTIES_FILE, stored);
}

/* ------------------------------ submissions ------------------------------ */

/** Every submission across all bounties (seed + stored), newest first. */
export async function getAllSubmissions(): Promise<Submission[]> {
  const stored = await readJson<Submission>(SUBMISSIONS_FILE);
  const byId = new Map<string, Submission>();
  for (const s of SEED_SUBMISSIONS) byId.set(s.id, s);
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

  const stored = await readJson<Submission>(SUBMISSIONS_FILE);
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
  stored.push(submission);
  await writeJson(SUBMISSIONS_FILE, stored);

  // Count unique hunters, mirroring the contract's submissionCount.
  const hunters = new Set(
    (await getSubmissions(input.bountyId)).map((s) => s.hunter.toLowerCase())
  );
  await saveBountyState({ ...bounty, submissionCount: hunters.size });
  return submission;
}

/* ----------------------------- creator actions --------------------------- */

export async function approveSubmission(input: {
  bountyId: string;
  submissionId: string;
  caller: string;
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.creator.toLowerCase() !== input.caller.toLowerCase())
    throw new Error("Only the creator can approve");
  if (bounty.status !== BountyStatus.Open) throw new Error("Bounty is not open");

  const subs = await readJson<Submission>(SUBMISSIONS_FILE);
  const target =
    subs.find((s) => s.id === input.submissionId) ??
    SEED_SUBMISSIONS.find((s) => s.id === input.submissionId);
  if (!target || target.bountyId !== input.bountyId)
    throw new Error("Submission not found");

  // Mark the winning submission approved (copy seed submissions into the store).
  const winning: Submission = { ...target, approved: true };
  const idx = subs.findIndex((s) => s.id === winning.id);
  if (idx >= 0) subs[idx] = winning;
  else subs.push(winning);
  await writeJson(SUBMISSIONS_FILE, subs);

  const next: Bounty = {
    ...bounty,
    status: BountyStatus.Paid,
    winner: target.hunter,
  };
  await saveBountyState(next);
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
  await saveBountyState(next);
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
  await saveBountyState(next);
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
  await saveBountyState(next);
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
}): Promise<Bounty> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  if (bounty.status !== BountyStatus.Disputed)
    throw new Error("Bounty is not disputed");

  if (!input.winnerSubmissionId) {
    const next: Bounty = { ...bounty, status: BountyStatus.Reclaimed };
    await saveBountyState(next);
    return next;
  }

  const subs = await getSubmissions(input.bountyId);
  const target = subs.find((s) => s.id === input.winnerSubmissionId);
  if (!target) throw new Error("Submission not found");

  // Persist the winning submission as approved (copy seed rows into the store).
  const stored = await readJson<Submission>(SUBMISSIONS_FILE);
  const winning: Submission = { ...target, approved: true };
  const idx = stored.findIndex((s) => s.id === winning.id);
  if (idx >= 0) stored[idx] = winning;
  else stored.push(winning);
  await writeJson(SUBMISSIONS_FILE, stored);

  const next: Bounty = {
    ...bounty,
    status: BountyStatus.Paid,
    winner: target.hunter,
  };
  await saveBountyState(next);
  return next;
}

/* --------------------------------- reports -------------------------------- */

/** All reports, newest first (seed + stored, stored overriding seed). */
export async function getReports(): Promise<Report[]> {
  const stored = await readJson<Report>(REPORTS_FILE);
  const byId = new Map<string, Report>();
  for (const r of SEED_REPORTS) byId.set(r.id, r);
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

  const stored = await readJson<Report>(REPORTS_FILE);
  const report: Report = {
    id: `report-${Date.now()}-${stored.length}`,
    bountyId: input.bountyId,
    reporter: input.reporter,
    reason: input.reason,
    details: input.details.trim().slice(0, 2000),
    createdAt: Date.now(),
    status: "open",
  };
  stored.push(report);
  await writeJson(REPORTS_FILE, stored);
  return report;
}

export async function setReportStatus(
  id: string,
  status: Report["status"]
): Promise<Report> {
  const all = await getReports();
  const target = all.find((r) => r.id === id);
  if (!target) throw new Error("Report not found");
  const next: Report = { ...target, status };
  const stored = await readJson<Report>(REPORTS_FILE);
  const idx = stored.findIndex((r) => r.id === id);
  if (idx >= 0) stored[idx] = next;
  else stored.push(next); // seed report being resolved — copy into the store
  await writeJson(REPORTS_FILE, stored);
  return next;
}

/* ------------------------------- moderation ------------------------------- */

export async function getModeration(): Promise<ModerationEntry[]> {
  return readJson<ModerationEntry>(MODERATION_FILE);
}

export async function getModerationFor(
  bountyId: string
): Promise<ModerationEntry | undefined> {
  return (await getModeration()).find((m) => m.bountyId === bountyId);
}

async function getHiddenIds(): Promise<Set<string>> {
  return new Set((await getModeration()).map((m) => m.bountyId));
}

/** Hide a bounty from all listing surfaces. UI-only — escrow rules still apply. */
export async function hideBounty(input: {
  bountyId: string;
  reason: string;
  moderator: string;
}): Promise<ModerationEntry> {
  const bounty = await getBounty(input.bountyId);
  if (!bounty) throw new Error("Bounty not found");
  const entries = await getModeration();
  const entry: ModerationEntry = {
    bountyId: input.bountyId,
    reason: input.reason.trim() || "Violates content policy",
    moderator: input.moderator,
    hiddenAt: Date.now(),
  };
  const idx = entries.findIndex((m) => m.bountyId === input.bountyId);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  await writeJson(MODERATION_FILE, entries);
  return entry;
}

export async function unhideBounty(bountyId: string): Promise<void> {
  const entries = await getModeration();
  await writeJson(
    MODERATION_FILE,
    entries.filter((m) => m.bountyId !== bountyId)
  );
}
