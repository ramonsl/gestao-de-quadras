import Link from "next/link";

export default function SuspensaPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-[var(--bg-app)] px-4">
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] mb-4 font-bold text-white text-lg"
          style={{ backgroundColor: "var(--text-3)" }}
        >
          A
        </div>

        <div
          className="bg-white border border-[var(--danger-border)] rounded-[var(--radius-card)] p-6"
          style={{ backgroundColor: "var(--danger-bg)", boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="text-base font-semibold mb-2" style={{ color: "var(--danger)" }}>
            Assinatura suspensa
          </h1>
          <p className="text-sm text-[var(--text-2)]">
            O acesso a esta arena está temporariamente suspenso.
            Entre em contato com o administrador da arena para regularizar a situação.
          </p>
        </div>

        <p className="text-rule mt-4">
          Se você é o administrador, acesse o suporte pelo portal Arena SaaS.
        </p>
      </div>
    </main>
  );
}
