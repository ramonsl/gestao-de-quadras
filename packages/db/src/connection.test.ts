import { describe, it, expect } from "vitest";
import { db } from "./connection";

describe("connection (packages/db)", () => {
  it("expõe a instância Drizzle compartilhada com execute()", () => {
    expect(db).toBeDefined();
    expect(typeof db.execute).toBe("function");
  });
});
