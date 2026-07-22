import { describe, it, expect } from "vitest";
import {
  createAdvertiser,
  listAdvertisers,
  getAdvertiserById,
  updateAdvertiser,
  deleteAdvertiser,
} from "./advertiser.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "user-1",
  } as any;
};

const advRow = (over: Record<string, unknown> = {}) => ({
  id: "adv1",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  name: "Padel Store LTDA",
  document: "12345678000199",
  email: "financeiro@padelstore.com",
  phone: "+5551999999999",
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("Advertiser Service (PUB-01)", () => {
  it("rejeita tenant_id inválido", async () => {
    await expect(listAdvertisers({ db: {}, tenantId: "x" } as any)).rejects.toThrow(/tenant_id inválido/i);
  });

  it("normaliza o documento (tira máscara) e cria o anunciante", async () => {
    // 1ª: checagem de unicidade (vazia); 2ª: INSERT; 3ª: auditoria
    const res = await createAdvertiser(
      { name: "Padel Store LTDA", document: "12.345.678/0001-99", email: "financeiro@padelstore.com" } as any,
      ctx([[], [advRow()]])
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.advertiser.document).toBe("12345678000199");
  });

  it("rejeita documento com tamanho inválido (nem CPF nem CNPJ)", async () => {
    await expect(
      createAdvertiser({ name: "X", document: "123" } as any, ctx([[]]))
    ).rejects.toThrow();
  });

  it("falha com document_taken quando já existe o mesmo documento no tenant", async () => {
    const res = await createAdvertiser(
      { name: "Outro", document: "12345678000199" } as any,
      ctx([[{ id: "existente" }]]) // unicidade encontra registro → não insere
    );
    expect(res).toEqual({ success: false, reason: "document_taken" });
  });

  it("lista, busca por id e retorna null quando não existe", async () => {
    expect(await listAdvertisers(ctx([[advRow()]]))).toHaveLength(1);
    expect((await getAdvertiserById("adv1", ctx([[advRow()]])))?.id).toBe("adv1");
    expect(await getAdvertiserById("nope", ctx([[]]))).toBeNull();
  });

  it("atualiza com sucesso (documento livre)", async () => {
    const res = await updateAdvertiser("adv1", { name: "Padel Store S/A" }, ctx([[advRow({ name: "Padel Store S/A" })]]));
    expect(res.success).toBe(true);
    if (res.success) expect(res.advertiser.name).toBe("Padel Store S/A");
  });

  it("atualiza para documento já usado por outro → document_taken", async () => {
    const res = await updateAdvertiser("adv1", { document: "99999999000191" }, ctx([[{ id: "outro" }]]));
    expect(res).toEqual({ success: false, reason: "document_taken" });
  });

  it("atualizar inexistente → not_found", async () => {
    // documento presente: 1ª unicidade (vazia); 2ª UPDATE (vazio) → not_found
    const res = await updateAdvertiser("nope", { document: "12345678000199" }, ctx([[], []]));
    expect(res).toEqual({ success: false, reason: "not_found" });
  });

  it("exclui (true) e não encontra (false)", async () => {
    expect(await deleteAdvertiser("adv1", ctx([[{ id: "adv1" }]]))).toBe(true);
    expect(await deleteAdvertiser("nope", ctx([[]]))).toBe(false);
  });
});
