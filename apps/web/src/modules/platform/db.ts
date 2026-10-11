import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
const holder = globalThis as unknown as { clupioPrisma?: PrismaClient };
export function db(): PrismaClient {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  holder.clupioPrisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  return holder.clupioPrisma;
}
