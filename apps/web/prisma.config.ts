import { defineConfig } from "prisma/config";

// Prisma 7 CLI config (generate / db push / migrate). The runtime client gets
// its connection through the pg driver adapter in lib/db.ts instead. The
// placeholder keeps `prisma generate` working when no DATABASE_URL is set
// (JSON preview mode, CI builds); db:push obviously needs the real one.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
