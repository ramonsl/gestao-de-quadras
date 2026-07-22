const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos (integer) para BRL exibível (regra 6: dinheiro nunca em float). */
export function formatCentsToBRL(cents: number): string {
  return BRL_FORMATTER.format(cents / 100);
}
