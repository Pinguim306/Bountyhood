import { promises as fs } from "fs";
import path from "path";
import { BountyStatus } from "./contract";
import { proofHash } from "./proof";
import { SEED_BOUNTIES, SEED_SUBMISSIONS } from "./seed";
import type { Bounty, BountyMetadata, Submission } from "./types";

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

/** All bounties, newest first (seed + user-created, stored overriding seed). */
export async function getBounties(): Promise<Bounty[]> {
  const stored = await readJson<Bounty>(BOUNTIES_FILE);
  const byId = new Map<string, Bounty>();
  for (const b of SEED_BOUNTIES) byId.set(b.id, b);
  for (const b of stored) byId.set(b.id, b);
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getBounty(id: string): Promise<Bounty | undefined> {
  return (await getBounties()).find((b) => b.id === id);
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

export async function getSubmissions(bountyId: string): Promise<Submission[]> {
  const stored = await readJson<Submission>(SUBMISSIONS_FILE);
  const all = [...SEED_SUBMISSIONS, ...stored].filter(
    (s) => s.bountyId === bountyId
  );
  // De-dup by id (stored overrides seed) and sort newest first.
  const byId = new Map(all.map((s) => [s.id, s]));
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
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
  if (Math.floor(Date.now() / 1000) <= bounty.deadline)
    throw new Error("Deadline has not passed");

  const next: Bounty = { ...bounty, status: BountyStatus.Reclaimed };
  await saveBountyState(next);
  return next;
}
