/**
 * Runner de migrations (Drizzle). Modelo row-level: um único schema, migrations
 * aplicadas UMA vez (sem replicação por tenant).
 *
 * Local:  pnpm db:migrate            (tsx src/migrate.ts → usa ./drizzle)
 * Deploy: node db-migrate.cjs        (bundle esbuild; MIGRATIONS_DIR aponta a pasta)
 */
import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./connection";

// No bundle do deploy, `__dirname` muda; permite apontar a pasta de migrations
// explicitamente via env (o Dockerfile define MIGRATIONS_DIR=/app/drizzle).
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, "../drizzle");

async function main() {
  console.log(`Aplicando migrations de ${migrationsFolder}…`);
  await migrate(db, { migrationsFolder });
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
