import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { databasePool } from "../../lib/postgres";
const holder = globalThis as unknown as { quizdipPrisma?: PrismaClient };
export function db(): PrismaClient {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  holder.quizdipPrisma ??= new PrismaClient({ adapter: new PrismaPg(databasePool()) });
  return holder.quizdipPrisma;
}
