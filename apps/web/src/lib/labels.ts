/** Rótulos de perfil em pt-BR — fonte única para sidebar, tabelas e formulários. */
export const ROLE_LABELS = {
  admin: "Admin",
  gerente: "Gerente",
  atendente: "Atendente",
} as const;

export type RoleSlug = keyof typeof ROLE_LABELS;
