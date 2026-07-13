import { promises as fs } from "fs";
import path from "path";
import { BountyStatus } from "./contract";
import { SEED_BOUNTIES } from "./seed";
import type { Bounty, BountyMetadata } from "./types";

/**
 * MVP metadata store backed by a JSON file. Stands in for Postgres + the
 * on-chain indexer (Phase 3). Server-only.
 *
 * In preview mode it merges seed samples with anything created via the API so
 * the create -> browse -> detail flow works end-to-end without a deployed
 * contract.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "bounties.json");

async function readFile(): Promise<Bounty[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Bounty[];
  } catch {
    return [];
  }
}

async function writeFile(rows: Bounty[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

/** All bounties, newest first (seed + user-created, de-duplicated by id). */
export async function getBounties(): Promise<Bounty[]> {
  const stored = await readFile();
  const byId = new Map<string, Bounty>();
  for (const b of SEED_BOUNTIES) byId.set(b.id, b);
  for (const b of stored) byId.set(b.id, b);
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getBounty(id: string): Promise<Bounty | undefined> {
  return (await getBounties()).find((b) => b.id === id);
}

let draftCounter = 1000;

/** Create a bounty from off-chain metadata (preview mode: mints a local id). */
export async function createBounty(input: {
  metadata: Omit<BountyMetadata, "id" | "createdAt">;
  rewardWei: string;
  deadline: number;
}): Promise<Bounty> {
  const stored = await readFile();
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
  await writeFile(stored);
  return bounty;
}
