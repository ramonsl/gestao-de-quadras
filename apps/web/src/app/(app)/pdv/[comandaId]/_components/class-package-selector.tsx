"use client";

import type { ClassPackage } from "@gestao-de-quadras/db/schema";
import { formatCentsToBRL } from "@/lib/currency";

interface ClassPackageSelectorProps {
  classPackages: ClassPackage[];
  onSelectPackage: (pkg: ClassPackage) => void;
}

export function ClassPackageSelector({ classPackages, onSelectPackage }: ClassPackageSelectorProps) {
  if (classPackages.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-[var(--radius-card)]">
        Nenhum pacote de aulas ativo cadastrado.
        <br />
        <span className="text-xs">Cadastre pacotes em Configurações → Pacotes de Aulas.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {classPackages.map((pkg) => (
        <button
          key={pkg.id}
          type="button"
          onClick={() => onSelectPackage(pkg)}
          className="flex flex-col items-start gap-1 p-4 bg-white border border-[var(--border)] rounded-[var(--radius-card)] text-left hover:border-[var(--accent)] hover:shadow-sm transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] px-1.5 py-0.5 bg-[var(--accent)]/10 rounded">
            Pacote de Aulas
          </span>
          <p className="font-bold text-sm text-[var(--text-1)] mt-1 leading-tight">{pkg.name}</p>
          <p className="text-xs text-[var(--text-3)]">{pkg.totalClassCount} aula{pkg.totalClassCount !== 1 ? "s" : ""}</p>
          <p className="text-base font-extrabold text-[var(--text-1)] mt-auto pt-2">
            {formatCentsToBRL(pkg.priceInCents)}
          </p>
        </button>
      ))}
    </div>
  );
}
