import { describe, it, expect } from "vitest";
import { formatCentsToBRL } from "./currency";

/**
 * Regra 6, CLAUDE.md: dinheiro sempre em centavos (integer), nunca float.
 * `formatCentsToBRL` é o único ponto de conversão pra exibição em telas
 * (PDV, extratos etc.) — usado por `ComandaWorkspace`/`ProductGrid` (PDV-02/03).
 *
 * Nota: `Intl.NumberFormat("pt-BR", ...)` separa "R$" do valor com um espaço
 * NÃO separável (U+00A0), não um espaço comum — por isso as asserções usam
 * regex com `\s` (que casa ambos) em vez de comparar a string literal inteira,
 * evitando um caractere invisível "escondido" no arquivo de teste.
 */
describe("formatCentsToBRL", () => {
  it("formata zero centavos", () => {
    expect(formatCentsToBRL(0)).toMatch(/^R\$\s0,00$/);
  });

  it("formata um valor exato em milhares", () => {
    expect(formatCentsToBRL(150000)).toMatch(/^R\$\s1\.500,00$/);
  });

  it("formata centavos quebrados", () => {
    expect(formatCentsToBRL(1050)).toMatch(/^R\$\s10,50$/);
  });

  it("formata o menor valor possível (1 centavo)", () => {
    expect(formatCentsToBRL(1)).toMatch(/^R\$\s0,01$/);
  });

  it("formata valores negativos (ex.: estornos)", () => {
    expect(formatCentsToBRL(-500)).toMatch(/^-R\$\s5,00$/);
  });

  it("arredonda centavos fracionários (defensivo — nunca deveria ocorrer em produção, regra 6)", () => {
    expect(formatCentsToBRL(1050.5)).toMatch(/^R\$\s10,51$/);
    expect(formatCentsToBRL(1050.4)).toMatch(/^R\$\s10,50$/);
  });
});
