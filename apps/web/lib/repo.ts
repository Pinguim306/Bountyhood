import { jsonRepo } from "./repo-json";
import { dbRepo } from "./repo-db";
import type {
  Bounty,
  ModerationEntry,
  Profile,
  Report,
  Submission,
} from "./types";

/**
 * Persistence boundary for the off-chain store. Business rules live in
 * store.ts; a repo only loads and saves rows.
 *
 * Two backends:
 *  - Postgres via Prisma when DATABASE_URL is set (production — Vercel etc.)
 *  - JSON files under .data/ otherwise (zero-config local dev and demos)
 *
 * Reads are coarse (full table) on purpose: MVP-scale data, one code path for
 * both backends, and every filter/aggregate stays in one place (store.ts).
 */
export interface StoreRepo {
  readBounties(): Promise<Bounty[]>;
  upsertBounty(b: Bounty): Promise<void>;
  readSubmissions(): Promise<Submission[]>;
  upsertSubmission(s: Submission): Promise<void>;
  readReports(): Promise<Report[]>;
  upsertReport(r: Report): Promise<void>;
  readModeration(): Promise<ModerationEntry[]>;
  upsertModeration(m: ModerationEntry): Promise<void>;
  deleteModeration(bountyId: string): Promise<void>;
  readProfiles(): Promise<Profile[]>;
  upsertProfile(p: Profile): Promise<void>;
}

export const usingDatabase = !!process.env.DATABASE_URL;

export const repo: StoreRepo = usingDatabase ? dbRepo : jsonRepo;
