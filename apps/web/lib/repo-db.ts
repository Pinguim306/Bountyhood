import { getPrisma } from "./db";
import type { StoreRepo } from "./repo";
import type {
  Bounty,
  ModerationEntry,
  Report,
  ReportReason,
  Submission,
} from "./types";
import type {
  Bounty as DbBounty,
  Report as DbReport,
  Submission as DbSubmission,
} from "./generated/prisma/client";

/**
 * Postgres repo (Prisma 7 + pg adapter). Rows mirror lib/types.ts one-to-one;
 * the only translation is BigInt columns <-> JS numbers and null <-> optional.
 */

function toBounty(row: DbBounty): Bounty {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deliverables: row.deliverables,
    category: row.category,
    creator: row.creator,
    createdAt: Number(row.createdAt),
    rewardWei: row.rewardWei,
    deadline: Number(row.deadline),
    status: row.status,
    submissionCount: row.submissionCount,
    winner: row.winner ?? undefined,
    txHash: row.txHash ?? undefined,
    disputedBy: row.disputedBy ?? undefined,
  };
}

function fromBounty(b: Bounty) {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    deliverables: b.deliverables,
    category: b.category,
    creator: b.creator,
    createdAt: BigInt(b.createdAt),
    rewardWei: b.rewardWei,
    deadline: BigInt(b.deadline),
    status: b.status,
    submissionCount: b.submissionCount,
    winner: b.winner ?? null,
    txHash: b.txHash ?? null,
    disputedBy: b.disputedBy ?? null,
  };
}

function toSubmission(row: DbSubmission): Submission {
  return {
    id: row.id,
    bountyId: row.bountyId,
    hunter: row.hunter,
    summary: row.summary,
    links: row.links,
    proofHash: row.proofHash,
    createdAt: Number(row.createdAt),
    approved: row.approved,
  };
}

function toReport(row: DbReport): Report {
  return {
    id: row.id,
    bountyId: row.bountyId,
    reporter: row.reporter,
    reason: row.reason as ReportReason,
    details: row.details,
    createdAt: Number(row.createdAt),
    status: row.status as Report["status"],
  };
}

export const dbRepo: StoreRepo = {
  async readBounties() {
    const rows = await getPrisma().bounty.findMany();
    return rows.map(toBounty);
  },
  async upsertBounty(b: Bounty) {
    const data = fromBounty(b);
    await getPrisma().bounty.upsert({
      where: { id: b.id },
      create: data,
      update: data,
    });
  },

  async readSubmissions() {
    const rows = await getPrisma().submission.findMany();
    return rows.map(toSubmission);
  },
  async upsertSubmission(s: Submission) {
    const data = { ...s, createdAt: BigInt(s.createdAt) };
    await getPrisma().submission.upsert({
      where: { id: s.id },
      create: data,
      update: data,
    });
  },

  async readReports() {
    const rows = await getPrisma().report.findMany();
    return rows.map(toReport);
  },
  async upsertReport(r: Report) {
    const data = { ...r, createdAt: BigInt(r.createdAt) };
    await getPrisma().report.upsert({
      where: { id: r.id },
      create: data,
      update: data,
    });
  },

  async readModeration() {
    const rows = await getPrisma().moderation.findMany();
    return rows.map((m) => ({
      bountyId: m.bountyId,
      reason: m.reason,
      moderator: m.moderator,
      hiddenAt: Number(m.hiddenAt),
    })) as ModerationEntry[];
  },
  async upsertModeration(m: ModerationEntry) {
    const data = { ...m, hiddenAt: BigInt(m.hiddenAt) };
    await getPrisma().moderation.upsert({
      where: { bountyId: m.bountyId },
      create: data,
      update: data,
    });
  },
  async deleteModeration(bountyId: string) {
    await getPrisma().moderation.deleteMany({ where: { bountyId } });
  },
};
