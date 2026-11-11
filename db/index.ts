import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.pg) globalForDb.pg = postgres(url, { max: 5 });
  return globalForDb.pg;
}

export function getDb() {
  return drizzle(client(), { schema });
}
