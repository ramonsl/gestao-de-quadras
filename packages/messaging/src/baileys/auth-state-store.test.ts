import { describe, it, expect } from "vitest";
import { usePostgresAuthState, clearAuthState } from "./auth-state-store";
import { createFakeArenaDb } from "../test/fake-arena-db";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

describe("usePostgresAuthState", () => {
  it("gera credenciais novas (initAuthCreds) quando não há linha persistida", async () => {
    const fake = createFakeArenaDb();
    const { state } = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });

    expect(state.creds.registered).toBe(false);
    expect(state.creds.noiseKey).toBeDefined();
  });

  it("persiste e recarrega as credenciais via saveCreds (round-trip)", async () => {
    const fake = createFakeArenaDb();
    const { state, saveCreds } = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });

    // Baileys muta `state.creds` in-place antes de disparar `creds.update`.
    (state.creds as unknown as { registered: boolean }).registered = true;
    await saveCreds();

    const reloaded = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });
    expect(reloaded.state.creds.registered).toBe(true);
  });

  it("isola credenciais entre tenants", async () => {
    const fake = createFakeArenaDb();
    const a = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });
    (a.state.creds as unknown as { registered: boolean }).registered = true;
    await a.saveCreds();

    const b = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_B });
    expect(b.state.creds.registered).toBe(false);
  });

  it("get/set de chaves de sinal faz round-trip por tipo e id", async () => {
    const fake = createFakeArenaDb();
    const { state } = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });

    await state.keys.set({ "pre-key": { "1": { public: new Uint8Array([1, 2, 3]), private: new Uint8Array([4, 5, 6]) } } });
    const result = await state.keys.get("pre-key", ["1", "2"]);

    expect(Object.keys(result)).toEqual(["1"]);
    expect(Array.from(result["1"].public)).toEqual([1, 2, 3]);
  });

  it("set com valor null remove a chave", async () => {
    const fake = createFakeArenaDb();
    const { state } = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });

    await state.keys.set({ session: { abc: new Uint8Array([9]) } });
    await state.keys.set({ session: { abc: null } });
    const result = await state.keys.get("session", ["abc"]);

    expect(result).toEqual({});
  });

  it("isola chaves entre tenants", async () => {
    const fake = createFakeArenaDb();
    const a = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });
    await a.state.keys.set({ session: { shared: new Uint8Array([1]) } });

    const b = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_B });
    const result = await b.state.keys.get("session", ["shared"]);

    expect(result).toEqual({});
  });
});

describe("clearAuthState", () => {
  it("remove creds e keys do tenant, sem afetar outros tenants", async () => {
    const fake = createFakeArenaDb();
    const a = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });
    (a.state.creds as unknown as { registered: boolean }).registered = true;
    await a.saveCreds();
    await a.state.keys.set({ session: { k: new Uint8Array([1]) } });

    const b = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_B });
    (b.state.creds as unknown as { registered: boolean }).registered = true;
    await b.saveCreds();

    await clearAuthState({ db: fake.db, tenantId: TENANT_A });

    const reloadedA = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_A });
    expect(reloadedA.state.creds.registered).toBe(false);

    const reloadedB = await usePostgresAuthState({ db: fake.db, tenantId: TENANT_B });
    expect(reloadedB.state.creds.registered).toBe(true);
  });
});
