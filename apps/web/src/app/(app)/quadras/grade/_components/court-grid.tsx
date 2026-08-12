"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";
import type { CourtGrid as CourtGridData, CourtGridSlotCell } from "@gestao-de-quadras/core/courts/court-booking.service";
import { formatCentsToBRL } from "@/lib/currency";
import { BookSlotDialog, type ComandaOption, type SelectedSlotRange } from "./book-slot-dialog";

export function CourtGrid({
  grid,
  date,
  comandaOptions,
}: {
  grid: CourtGridData;
  date: string;
  comandaOptions: ComandaOption[];
}) {
  const [selectedRange, setSelectedRange] = useState<SelectedSlotRange | null>(null);

  // Seleção multi-slot (mesma quadra)
  const [selectionCourtId, setSelectionCourtId] = useState<string | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, CourtGridSlotCell>();
    for (const cell of grid.cells) map.set(`${cell.courtId}|${cell.startTimeHHMM}`, cell);
    return map;
  }, [grid.cells]);

  const handleSlotClick = (courtId: string, courtName: string, cell: CourtGridSlotCell) => {
    if (cell.status !== "free") return;

    // Se já tinha selecionado uma quadra diferente ou nada, inicia nova seleção
    if (selectionCourtId !== courtId || selectedTimes.length === 0) {
      setSelectionCourtId(courtId);
      setSelectedTimes([cell.startTimeHHMM]);
      return;
    }

    // Se clicou em outro slot livre da MESMA quadra: expande o intervalo
    const sortedRowStartTimes = grid.rowStartTimes;
    const startIndex = sortedRowStartTimes.indexOf(selectedTimes[0]);
    const currentIndex = sortedRowStartTimes.indexOf(cell.startTimeHHMM);

    if (startIndex === -1 || currentIndex === -1) return;

    const fromIdx = Math.min(startIndex, currentIndex);
    const toIdx = Math.max(startIndex, currentIndex);

    const candidateTimes = sortedRowStartTimes.slice(fromIdx, toIdx + 1);

    // Valida que TODOS os slots no intervalo estão livres
    const allFree = candidateTimes.every((t) => {
      const c = cellByKey.get(`${courtId}|${t}`);
      return c && c.status === "free";
    });

    if (allFree) {
      setSelectedTimes(candidateTimes);
    } else {
      // Se houver algum ocupado no meio, reseta e inicia a partir do atual
      setSelectionCourtId(courtId);
      setSelectedTimes([cell.startTimeHHMM]);
    }
  };

  const handleOpenDialogForSelection = (courtId: string, courtName: string) => {
    if (selectedTimes.length === 0) return;

    const sortedTimes = [...selectedTimes].sort();
    const firstStart = sortedTimes[0];
    const lastStart = sortedTimes[sortedTimes.length - 1];

    const lastCell = cellByKey.get(`${courtId}|${lastStart}`);
    const endTimeHHMM = lastCell?.endTimeHHMM ?? lastStart;

    let totalPriceInCents = 0;
    for (const t of sortedTimes) {
      const c = cellByKey.get(`${courtId}|${t}`);
      if (c) totalPriceInCents += c.priceInCents;
    }

    setSelectedRange({
      courtId,
      courtName,
      startTimeHHMM: firstStart,
      endTimeHHMM,
      slotCount: sortedTimes.length,
      priceInCents: totalPriceInCents,
    });
  };

  return (
    <>
      {/* Barra de ação flutuante quando múltiplos slots são selecionados */}
      {selectionCourtId && selectedTimes.length > 0 && (
        <div className="mb-2 p-2 rounded-[var(--radius-card)] bg-[var(--accent-tint-soft)] border border-[var(--accent-tint)] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[var(--accent-hover)]">
              {grid.courts.find((c) => c.courtId === selectionCourtId)?.courtName}:
            </span>
            <span className="font-semibold text-[var(--text-1)]">
              {selectedTimes.length} bloco(s) ({selectedTimes.length * 30} min)
            </span>
            <span className="text-[var(--text-3)]">
              · {selectedTimes.slice().sort()[0]} até {
                cellByKey.get(`${selectionCourtId}|${[...selectedTimes].sort().pop()}`)?.endTimeHHMM
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectionCourtId(null);
                setSelectedTimes([]);
              }}
              className="text-xs text-[var(--text-3)] hover:text-[var(--text-1)] px-2 py-1"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                const court = grid.courts.find((c) => c.courtId === selectionCourtId);
                if (court) handleOpenDialogForSelection(court.courtId, court.courtName);
              }}
              className="h-7 px-3 text-xs font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-[var(--radius-button)] transition-colors"
            >
              Confirmar ({selectedTimes.length} blocos)
            </button>
          </div>
        </div>
      )}

      {/* Grade Densificada (Compacta) */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)] bg-[var(--bg-sunken)]">
              <th className="px-3 py-2 sticky left-0 bg-[var(--bg-sunken)] z-10 font-bold">HORÁRIO</th>
              {grid.courts.map((court) => (
                <th key={court.courtId} className="px-2 py-2 whitespace-nowrap font-bold text-[var(--text-1)]">
                  {court.courtName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rowStartTimes.map((start) => (
              <tr key={start} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-gray-50/50">
                <td className="px-3 py-1 font-semibold text-[var(--text-2)] tabular-nums sticky left-0 bg-white z-10 border-r border-[var(--border-soft)]">
                  {start}
                </td>
                {grid.courts.map((court) => {
                  const cell = cellByKey.get(`${court.courtId}|${start}`);
                  const isSelectedInMulti =
                    selectionCourtId === court.courtId && selectedTimes.includes(start);

                  return (
                    <td key={court.courtId} className="px-1 py-1 align-top">
                      <SlotCell
                        cell={cell}
                        courtName={court.courtName}
                        isSelected={isSelectedInMulti}
                        onClick={() => {
                          if (cell) handleSlotClick(court.courtId, court.courtName, cell);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-3)]">
        <LegendDot className="border-[var(--border)] bg-white" label="Livre" />
        <LegendDot className="border-[var(--accent)] bg-[var(--accent-tint)]" label="Ocupado (Nome do Cliente)" />
        <LegendDot className="border-[var(--split-border)] bg-[var(--split-bg)]" label="Rateio (Nome 1 | Nome 2 | ...)" />
        <LegendDot className="border-[var(--success-border)] bg-[var(--success-bg)]" label="Mensalista Recorrente" />
        <LegendDot className="border-[var(--warning)]" label="Reservado Online" />
      </div>

      {selectedRange && (
        <BookSlotDialog
          open={!!selectedRange}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedRange(null);
              setSelectionCourtId(null);
              setSelectedTimes([]);
            }
          }}
          date={date}
          slot={selectedRange}
          comandaOptions={comandaOptions}
        />
      )}
    </>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-[3px] border ${className}`} />
      {label}
    </span>
  );
}

function SlotCell({
  cell,
  courtName,
  isSelected,
  onClick,
}: {
  cell: CourtGridSlotCell | undefined;
  courtName: string;
  isSelected?: boolean;
  onClick: () => void;
}) {
  if (!cell) {
    return <div className="h-9 flex items-center justify-center text-[var(--text-disabled)]">—</div>;
  }

  if (cell.status === "free") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Marcar ${courtName} às ${cell.startTimeHHMM}`}
        className={`w-full h-9 px-2 rounded-[var(--radius-control)] border text-left transition-colors flex items-center justify-between ${
          isSelected
            ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-2xs font-bold"
            : "border-[var(--border)] bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-tint-soft)] text-[var(--text-2)]"
        }`}
      >
        <span className="text-[11.5px] font-semibold">
          {isSelected ? "Selecionado" : "Livre"}
        </span>
        <span className={`text-[10px] tabular-nums ${isSelected ? "text-white/90" : "text-[var(--text-3)]"}`}>
          {formatCentsToBRL(cell.priceInCents)}
        </span>
      </button>
    );
  }

  if (cell.status === "reserved") {
    return (
      <div className="w-full h-9 px-2 rounded-[var(--radius-control)] border border-[var(--warning-border)] flex items-center justify-between bg-[var(--warning-bg)]">
        <span className="text-[11.5px] font-extrabold text-[var(--text-1)] truncate max-w-[130px]" title={cell.customerName ?? "Online"}>
          {cell.customerName ?? "Reserva Online"}
        </span>
        <span className="text-[9.5px] font-bold px-1 py-0.5 rounded-[var(--radius-control)] bg-[var(--warning-border)] text-[var(--text-1)] shrink-0">
          Online
        </span>
      </div>
    );
  }

  // Rateio entre múltiplas comandas (PDV-05): Exibe o NOME DAS PESSOAS direto!
  if (cell.splitParticipants && cell.splitParticipants.length > 0) {
    const names = cell.splitParticipants
      .map((p) => p.customerName ?? "Balcão")
      .join(" | ");

    const firstComandaId = cell.splitParticipants.find((p) => p.comandaId)?.comandaId;

    const inner = (
      <div
        className={`w-full h-9 px-2 rounded-[var(--radius-control)] border flex items-center justify-between gap-1 ${
          cell.isMonthly
            ? "border-[var(--success-border)] bg-[var(--success-bg)]"
            : "border-[var(--split-border)] bg-[var(--split-bg)]"
        }`}
        title={`Locação Rateada: ${names}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {cell.isMonthly && (
            <Repeat className="size-3 shrink-0 text-[var(--success)]" aria-label="Mensalista" />
          )}
          <span className={`text-[11.5px] font-extrabold truncate ${cell.isMonthly ? "text-[var(--success)]" : "text-[var(--split)]"}`}>
            {names}
          </span>
        </div>
        <span className={`text-[9.5px] font-bold px-1 py-0.5 rounded-[var(--radius-control)] shrink-0 ${cell.isMonthly ? "bg-[var(--success-border)] text-[var(--success)]" : "bg-[var(--split-border)] text-[var(--split)]"}`}>
          {cell.splitParticipants.length}P
        </span>
      </div>
    );

    return firstComandaId ? (
      <Link href={`/pdv/${firstComandaId}`} aria-label={`Abrir comanda de ${courtName} às ${cell.startTimeHHMM}`}>
        {inner}
      </Link>
    ) : (
      inner
    );
  }

  // booked (Ocupado simples): Exibe o NOME DO CLIENTE em destaque!
  const name = cell.customerName ?? "Venda Balcão";

  const inner = (
    <div
      className={`w-full h-9 px-2 rounded-[var(--radius-control)] border flex items-center justify-between gap-1 ${
        cell.isMonthly
          ? "border-[var(--success-border)] bg-[var(--success-bg)]"
          : "border-[var(--accent)] bg-[var(--accent-tint)]"
      }`}
      title={`Locação: ${name}`}
    >
      <div className="flex items-center gap-1 min-w-0">
        {cell.isMonthly && (
          <Repeat className="size-3 shrink-0 text-[var(--success)]" aria-label="Mensalista" />
        )}
        <span className={`text-[11.5px] font-extrabold truncate ${cell.isMonthly ? "text-[var(--success)]" : "text-[var(--accent-hover)]"}`}>
          {name}
        </span>
      </div>
    </div>
  );

  return cell.comandaId ? (
    <Link href={`/pdv/${cell.comandaId}`} aria-label={`Abrir comanda de ${courtName} às ${cell.startTimeHHMM}`}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
