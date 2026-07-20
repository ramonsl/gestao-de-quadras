/**
 * Módulos do sistema que podem ser habilitados por operador (SAAS-10/SAAS-12).
 *
 * Fonte única da verdade para os slugs de módulo. O módulo de "Configurações da
 * Arena" (SAAS-09) NÃO entra aqui: é sempre exclusivo do Admin e não é
 * configurável na matriz por operador.
 */
export const MODULES = [
  "pdv",
  "quadras",
  "crm",
  "filiacao",
  "pontos",
  "publicidade",
  "relatorios",
  "whatsapp",
] as const;

export type ModuleSlug = (typeof MODULES)[number];

/** Rótulos em pt-BR para exibição na UI */
export const MODULE_LABELS: Record<ModuleSlug, string> = {
  pdv: "PDV e Comandas",
  quadras: "Quadras / Grade de Locação",
  crm: "CRM",
  filiacao: "Filiação",
  pontos: "Pontos / Cashback",
  publicidade: "Publicidade",
  relatorios: "Relatórios / Dashboard",
  whatsapp: "Configurações de WhatsApp",
};

export function isModuleSlug(value: string): value is ModuleSlug {
  return (MODULES as readonly string[]).includes(value);
}
