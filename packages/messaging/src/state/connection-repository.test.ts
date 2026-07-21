import { describe, it, expect } from "vitest";
import { getOrCreateConnection, updateConnection, toSnapshot } from "./connection-repository";
import { createFakeArenaDb } from "../test/fake-arena-db";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

describe("getOrCreateConnection", () => {
  it("cria a linha singleton com status disconnected na primeira chamada", async () => {
    const fake = createFakeArenaDb();
    const record = await getOrCreateConnection({ db: fake.db, tenantId: TENANT_A });

    expect(record.status).toBe("disconnected");
    expect(record.tenantId).toBe(TENANT_A);
    expect(fake.connections.size).toBe(1);
  });

  it("retorna a mesma linha em chamadas subsequentes (idempotente)", async () => {
    const fake = createFakeArenaDb();
    const first = await getOrCreateConnection({ db: fake.db, tenantId: TENANT_A });
    const second = await getOrCreateConnection({ db: fake.db, tenantId: TENANT_A });

    expect(second.id).toBe(first.id);
    expect(fake.connections.size).toBe(1);
  });

  it("isola tenants distintos", async () => {
    const fake = createFakeArenaDb();
    await getOrCreateConnection({ db: fake.db, tenantId: TENANT_A });
    await getOrCreateConnection({ db: fake.db, tenantId: TENANT_B });

    expect(fake.connections.size).toBe(2);
  });
});

describe("updateConnection", () => {
  it("atualiza apenas os campos informados", async () => {
    const fake = createFakeArenaDb();
    await getOrCreateConnection({ db: fake.db, tenantId: TENANT_A });

    const updated = await updateConnection(
      { db: fake.db, tenantId: TENANT_A },
      { status: "qr_pending", qrCode: "abc123" }
    );

    expect(updated.status).toBe("qr_pending");
    expect(updated.qrCode).toBe("abc123");
    expect(updated.phoneNumber).toBeNull();
  });

  it("nunca vaza o estado de um tenant para outro", async () => {
    const fake = createFakeArenaDb();
    await getOrCreateConnection({ db: fake.db, tenantId: TENANT_A });
    await getOrCreateConnection({ db: fake.db, tenantId: TENANT_B });

    await updateConnection({ db: fake.db, tenantId: TENANT_A }, { status: "connected" });
    const tenantB = await getOrCreateConnection({ db: fake.db, tenantId: TENANT_B });

    expect(tenantB.status).toBe("disconnected");
  });
});

describe("toSnapshot", () => {
  it("mapeia o record para o snapshot exposto ao painel/eventos", async () => {
    const fake = createFakeArenaDb();
    const record = await updateConnection(
      { db: fake.db, tenantId: TENANT_A },
      { status: "connected", phoneNumber: "+5511999999999", reconnectAttempts: 2 }
    );

    const snapshot = toSnapshot(record);
    expect(snapshot).toEqual({
      status: "connected",
      qrCode: null,
      phoneNumber: "+5511999999999",
      reconnectAttempts: 2,
      updatedAt: record.updatedAt.toISOString(),
    });
  });
});
