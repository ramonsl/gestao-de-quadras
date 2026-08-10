import Link from "next/link";
import { CalendarDays, CreditCard, Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

/** Ações Rápidas do Gestor (CAD-08). */
export function QuickActionBar() {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionLink href="/pdv" icon={<Plus className="size-4" />}>
        Abrir Nova Comanda
      </ActionLink>
      <ActionLink href="/pdv" icon={<CreditCard className="size-4" />}>
        Receber Débito Pendente
      </ActionLink>
      {/* Reserva de quadra (RES-01/PDV-05) e edição de dados (CAD-06) ainda não implementadas. */}
      <ActionButtonDisabled icon={<CalendarDays className="size-4" />}>
        Reservar Quadra
      </ActionButtonDisabled>
      <ActionButtonDisabled icon={<Pencil className="size-4" />}>Editar Dados</ActionButtonDisabled>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 h-9 px-3.5 text-[13px] font-semibold text-white rounded-[var(--radius-button)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors duration-[180ms]"
    >
      {icon}
      {children}
    </Link>
  );
}

function ActionButtonDisabled({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title="Em breve"
      className="inline-flex items-center gap-2 h-9 px-3.5 text-[13px] font-semibold rounded-[var(--radius-button)] border border-[var(--border)] text-[var(--text-disabled)] cursor-not-allowed"
    >
      {icon}
      {children}
      <span className="text-[10px] font-medium">· em breve</span>
    </button>
  );
}
