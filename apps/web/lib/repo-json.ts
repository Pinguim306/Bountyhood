import { promises as fs } from "fs";
import path from "path";
import type { StoreRepo } from "./repo";
import type { Bounty, ModerationEntry, Report, Submission } from "./types";

/**
 * JSON-file repo: the zero-config backend for local dev and demos. Not for
 * serverless hosts (read-only/ephemeral filesystem) — set DATABASE_URL there.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const FILES = {
  bounties: path.join(DATA_DIR, "bounties.json"),
  submissions: path.join(DATA_DIR, "submissions.json"),
  reports: path.join(DATA_DIR, "reports.json"),
  moderation: path.join(DATA_DIR, "moderation.json"),
};

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

async function upsertBy<T>(
  file: string,
  row: T,
  match: (a: T) => boolean
): Promise<void> {
  const rows = await readJson<T>(file);
  const idx = rows.findIndex(match);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  await writeJson(file, rows);
}

export const jsonRepo: StoreRepo = {
  readBounties: () => readJson<Bounty>(FILES.bounties),
  upsertBounty: (b) => upsertBy(FILES.bounties, b, (x) => x.id === b.id),

  readSubmissions: () => readJson<Submission>(FILES.submissions),
  upsertSubmission: (s) =>
    upsertBy(FILES.submissions, s, (x) => x.id === s.id),

  readReports: () => readJson<Report>(FILES.reports),
  upsertReport: (r) => upsertBy(FILES.reports, r, (x) => x.id === r.id),

  readModeration: () => readJson<ModerationEntry>(FILES.moderation),
  upsertModeration: (m) =>
    upsertBy(FILES.moderation, m, (x) => x.bountyId === m.bountyId),
  deleteModeration: async (bountyId) => {
    const rows = await readJson<ModerationEntry>(FILES.moderation);
    await writeJson(
      FILES.moderation,
      rows.filter((m) => m.bountyId !== bountyId)
    );
  },
};
