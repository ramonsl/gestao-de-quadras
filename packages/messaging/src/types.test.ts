import { describe, it, expect } from "vitest";
import { toPublicStatus, type WhatsAppConnectionSnapshot } from "./types";

describe("toPublicStatus", () => {
  it("mantém só o status, nunca vaza qrCode ou phoneNumber", () => {
    const snapshot: WhatsAppConnectionSnapshot = {
      status: "qr_pending",
      qrCode: "segredo-de-pareamento",
      phoneNumber: "+5511999999999",
      reconnectAttempts: 2,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = toPublicStatus(snapshot);

    expect(result).toEqual({ status: "qr_pending" });
    expect(result).not.toHaveProperty("qrCode");
    expect(result).not.toHaveProperty("phoneNumber");
  });
});
