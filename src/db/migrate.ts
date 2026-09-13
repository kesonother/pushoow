import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

async function main() {
  const client = postgres(requireDatabaseUrl(), { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
