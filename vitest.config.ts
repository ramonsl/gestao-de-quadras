import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@gestao-de-quadras/db": path.resolve(__dirname, "./packages/db/src"),
    },
  },
});
