import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Lazy PrismaClient singleton (Prisma 7 + pg driver adapter). Constructed on
 * first use only, so importing this module is free when the app runs in
 * JSON-store preview mode (no DATABASE_URL). The global cache survives Next.js
 * dev-server hot reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — DB store unavailable");
    }
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  return globalForPrisma.prisma;
}
