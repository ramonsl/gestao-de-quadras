import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Helper padrão do shadcn/ui: mescla classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
