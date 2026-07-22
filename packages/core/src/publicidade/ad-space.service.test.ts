import { describe, it, expect } from "vitest";
import {
  createAdSpace,
  listAdSpaces,
  getAdSpaceById,
  updateAdSpace,
  deleteAdSpace,
} from "./ad-space.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "user-1",
  } as any;
};

const spaceRow = (over: Record<string, unknown> = {}) => ({
  id: "as1",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  name: "Placa 1 - Fundo da Quadra 1",
  space_type: "placa_fisica",
  status: "disponivel",
  reference_price_cents: 30000,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("AdSpace Service (PUB-01)", () => {
  it("rejeita tenant_id inválido", async () => {
    await expect(listAdSpaces({ db: {}, tenantId: "x" } as any)).rejects.toThrow(/tenant_id inválido/i);
  });

  it("cria espaço e mapeia snake -> camel", async () => {
    // 1ª: INSERT RETURNING; 2ª: auditoria
    const result = await createAdSpace(
      { name: "Placa 1 - Fundo da Quadra 1", spaceType: "placa_fisica", status: "disponivel", referencePriceCents: 30000 },
      ctx([[spaceRow()]])
    );
    expect(result.id).toBe("as1");
    expect(result.spaceType).toBe("placa_fisica");
    expect(result.referencePriceCents).toBe(30000);
  });

  it("rejeita tipo de espaço inválido (Zod)", async () => {
    await expect(
      createAdSpace({ name: "X", spaceType: "outdoor" as any, referencePriceCents: 100 } as any, ctx([[]]))
    ).rejects.toThrow();
  });

  it("rejeita valor de referência não positivo (Zod)", async () => {
    await expect(
      createAdSpace({ name: "X", spaceType: "lona", referencePriceCents: 0 } as any, ctx([[]]))
    ).rejects.toThrow();
  });

  it("lista os espaços do tenant", async () => {
    const result = await listAdSpaces(ctx([[spaceRow(), spaceRow({ id: "as2" })]]));
    expect(result).toHaveLength(2);
  });

  it("busca por id (encontrado)", async () => {
    const result = await getAdSpaceById("as1", ctx([[spaceRow()]]));
    expect(result?.id).toBe("as1");
  });

  it("retorna null quando o espaço não existe", async () => {
    expect(await getAdSpaceById("nope", ctx([[]]))).toBeNull();
  });

  it("atualiza e retorna o espaço", async () => {
    const result = await updateAdSpace("as1", { status: "manutencao" }, ctx([[spaceRow({ status: "manutencao" })]]));
    expect(result?.status).toBe("manutencao");
  });

  it("retorna null ao atualizar espaço inexistente", async () => {
    expect(await updateAdSpace("nope", { status: "ocupado" }, ctx([[]]))).toBeNull();
  });

  it("exclui (true) e não encontra (false)", async () => {
    expect(await deleteAdSpace("as1", ctx([[{ id: "as1" }]]))).toBe(true);
    expect(await deleteAdSpace("nope", ctx([[]]))).toBe(false);
  });
});
