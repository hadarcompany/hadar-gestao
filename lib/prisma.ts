import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Next route bundles can load this module separately in the same process.
// Reuse one pool in production too, so the configured limit applies to the app.
globalForPrisma.prisma = prisma;
