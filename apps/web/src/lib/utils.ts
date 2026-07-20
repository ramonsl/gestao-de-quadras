export type ClassValue = string | number | null | false | undefined;

/**
 * Concatena classes CSS ignorando valores falsy. Substituto leve de clsx/cn
 * (sem dependências externas).
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
