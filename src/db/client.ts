import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { requireDatabaseUrl } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
};

function createClient() {
  if (!globalForDb.postgres) {
    globalForDb.postgres = postgres(requireDatabaseUrl(), {
      max: 10,
      prepare: false,
    });
  }
  return globalForDb.postgres;
}

export function getDb() {
  return drizzle(createClient(), { schema });
}

export type Database = ReturnType<typeof getDb>;
