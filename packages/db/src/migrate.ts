/**
 * Runner de migrations (Drizzle). Modelo row-level: um único schema, migrations
 * aplicadas UMA vez (sem replicação por tenant).
 *
 *   pnpm db:migrate   →   tsx src/migrate.ts
 */
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./connection";

async function main() {
  console.log("Aplicando migrations…");
  await migrate(db, { migrationsFolder: `${__dirname}/../drizzle` });
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
