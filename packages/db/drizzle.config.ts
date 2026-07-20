import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/env";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
