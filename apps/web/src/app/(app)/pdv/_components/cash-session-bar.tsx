"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCentsToBRL } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { OpenCashDialog } from "./open-cash-dialog";
import { CashMovementDialog } from "./cash-movement-dialog";
import { CloseCashDialog } from "./close-cash-dialog";
import type { CashSession } from "@gestao-de-quadras/db/schema";
import { ElapsedTime } from "./elapsed-time";

interface CashSessionBarProps {
  initialSession: CashSession | null;
}

export function CashSessionBar({ initialSession }: CashSessionBarProps) {
  const router = useRouter();
  const [session, setSession] = useState<CashSession | null>(initialSession);

  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  function handleOpenedSuccess(newSession: CashSession) {
    setSession(newSession);
    router.refresh();
  }

  function handleClosedSuccess() {
    setSession(null);
    router.refresh();
  }

  if (!session) {
    return (
      <>
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-[var(--radius-card)] flex flex-wrap items-center justify-between gap-3 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">Nenhum Caixa Aberto no Momento</p>
              <p className="text-xs text-amber-700">
                Para operar o PDV, registrar vendas e receber pagamentos, abra uma sessão de caixa.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setIsOpenDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            🔓 Abrir Caixa Agora
          </Button>
        </div>

        <OpenCashDialog
          open={isOpenDialogOpen}
          onOpenChange={setIsOpenDialogOpen}
          onOpenedSuccess={handleOpenedSuccess}
        />
      </>
    );
  }

  return (
    <>
      <div className="p-3.5 bg-white border border-[var(--border)] rounded-[var(--radius-card)] flex flex-wrap items-center justify-between gap-3 shadow-sm text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-[var(--text-1)] uppercase text-[11px] tracking-wider">
              Caixa Aberto
            </span>
          </div>

          <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

          <div className="text-[var(--text-2)]">
            <span className="text-[var(--text-3)]">Troco Inicial: </span>
            <span className="font-bold text-[var(--text-1)]">
              {formatCentsToBRL(session.initialCashCents)}
            </span>
          </div>

          <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

          <div className="flex items-center gap-1 text-[var(--text-3)]">
            <span>Aberto há </span>
            <ElapsedTime fromISO={new Date(session.openedAt).toISOString()} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsMovementDialogOpen(true)}
            className="text-xs font-semibold"
          >
            💸 Sangria / Suprimento
          </Button>

          <Button
            type="button"
            onClick={() => setIsCloseDialogOpen(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs"
          >
            🔒 Fechar Caixa
          </Button>
        </div>
      </div>

      <CashMovementDialog
        open={isMovementDialogOpen}
        onOpenChange={setIsMovementDialogOpen}
        cashSessionId={session.id}
        onSuccess={() => router.refresh()}
      />

      <CloseCashDialog
        open={isCloseDialogOpen}
        onOpenChange={setIsCloseDialogOpen}
        cashSessionId={session.id}
        onSuccess={handleClosedSuccess}
      />
    </>
  );
}
