import type { CustomerProfile360 } from "@gestao-de-quadras/core/customers/customer-profile.service";
import { Badge } from "@/components/ui/badge";
import { Cake, Crown, Globe, MessageCircle, Mail } from "lucide-react";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Cabeçalho / Resumo do Perfil (CAD-08): identidade, foto (iniciais) e badges. */
export function ProfileHeader({ profile }: { profile: CustomerProfile360 }) {
  const { customer, optIn, isBirthdayThisMonth } = profile;
  const whatsappDigits = customer.whatsapp.replace(/\D/g, "");

  return (
    <div className="bg-[var(--bg-white)] border border-[var(--border)] rounded-[var(--radius-card)] p-5">
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 grid place-items-center w-14 h-14 rounded-full text-lg font-semibold"
          style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          {initials(customer.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--text-1)] truncate">{customer.name}</h1>
            {customer.globalCustomerId && (
              <Badge variant="outline" className="gap-1">
                <Globe className="size-3" /> Identidade Global
              </Badge>
            )}
            {isBirthdayThisMonth && (
              <Badge className="gap-1">
                <Cake className="size-3" /> Aniversariante do mês
              </Badge>
            )}
            <Badge variant={optIn.optIn ? "default" : "outline"} className="gap-1">
              LGPD: {optIn.optIn ? "Opt-in ativo" : "Sem consentimento"}
            </Badge>
            {profile.membership ? (
              <Badge variant={profile.membership.eligibleToday ? "default" : "outline"} className="gap-1">
                <Crown className="size-3" /> {profile.membership.planName}
                {!profile.membership.eligibleToday && " · fora da vigência"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[var(--text-disabled)]">Sem filiação</Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-2)]">
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
            >
              <MessageCircle className="size-3.5" /> {customer.whatsapp}
            </a>
            {customer.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {customer.email}
              </span>
            )}
            {customer.birthDate && (
              <span className="inline-flex items-center gap-1.5">
                <Cake className="size-3.5" />
                {new Date(`${customer.birthDate}T00:00:00`).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
