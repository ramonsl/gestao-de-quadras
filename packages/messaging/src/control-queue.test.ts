import { describe, it, expect } from "vitest";
import { whatsappControlJobSchema, WHATSAPP_CONTROL_QUEUE } from "./control-queue";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

describe("whatsappControlJobSchema", () => {
  it("aceita um job de connect válido", () => {
    const result = whatsappControlJobSchema.safeParse({
      type: "connect",
      tenantId: TENANT_ID,
      requestedByUserId: USER_ID,
    });
    expect(result.success).toBe(true);
  });

  it("aceita um job de disconnect válido", () => {
    const result = whatsappControlJobSchema.safeParse({
      type: "disconnect",
      tenantId: TENANT_ID,
      requestedByUserId: USER_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita type fora do enum", () => {
    const result = whatsappControlJobSchema.safeParse({
      type: "regenerate_qr",
      tenantId: TENANT_ID,
      requestedByUserId: USER_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita tenantId que não é UUID", () => {
    const result = whatsappControlJobSchema.safeParse({
      type: "connect",
      tenantId: "not-a-uuid",
      requestedByUserId: USER_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita requestedByUserId ausente", () => {
    const result = whatsappControlJobSchema.safeParse({ type: "connect", tenantId: TENANT_ID });
    expect(result.success).toBe(false);
  });
});

describe("WHATSAPP_CONTROL_QUEUE", () => {
  it("é um nome de fila estável", () => {
    expect(WHATSAPP_CONTROL_QUEUE).toBe("whatsapp.control");
  });
});
