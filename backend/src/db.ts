import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "./config.js"; // ensure .env is loaded

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL!),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
