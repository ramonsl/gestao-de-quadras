"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CourtGrid as CourtGridData, CourtGridSlotCell } from "@gestao-de-quadras/core/courts/court-booking.service";
import { formatCentsToBRL } from "@/lib/currency";
import { BookSlotDialog, type ComandaOption } from "./book-slot-dialog";

interface SelectedSlot {
  courtId: string;
  courtName: string;
  startTimeHHMM: string;
  endTimeHHMM: string;
  priceInCents: number;
}

export function CourtGrid({
  grid,
  date,
  comandaOptions,
}: {
  grid: CourtGridData;
  date: string;
  comandaOptions: ComandaOption[];
}) {
  const [selected, setSelected] = useState<SelectedSlot | null>(null);

  const cellByKey = useMemo(() => {
    const map = new Map<string, CourtGridSlotCell>();
    for (const cell of grid.cells) map.set(`${cell.courtId}|${cell.startTimeHHMM}`, cell);
    return map;
  }, [grid.cells]);

  return (
    <>
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
              <th className="px-4 py-3 sticky left-0 bg-white z-10">HORÁRIO</th>
              {grid.courts.map((court) => (
                <th key={court.courtId} className="px-3 py-3 whitespace-nowrap">
                  {court.courtName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rowStartTimes.map((start) => (
              <tr key={start} className="border-b border-[var(--border-soft)] last:border-0">
                <td className="px-4 py-2 font-medium text-[var(--text-2)] tabular-nums sticky left-0 bg-white z-10">
                  {start}
                </td>
                {grid.courts.map((court) => {
                  const cell = cellByKey.get(`${court.courtId}|${start}`);
                  return (
                    <td key={court.courtId} className="px-2 py-2 align-top">
                      <SlotCell
                        cell={cell}
                        courtName={court.courtName}
                        onBook={(c) =>
                          setSelected({
                            courtId: c.courtId,
                            courtName: court.courtName,
                            startTimeHHMM: c.startTimeHHMM,
                            endTimeHHMM: c.endTimeHHMM,
                            priceInCents: c.priceInCents,
                          })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-3)]">
        <LegendDot className="border-[var(--border)] bg-white" label="Livre" />
        <LegendDot className="border-[var(--accent)] bg-[var(--accent-tint)]" label="Ocupado" />
        <LegendDot className="border-purple-300 bg-purple-50" label="Rateio (Múltiplas comandas)" />
        <LegendDot className="border-[var(--warning)]" label="Reservado (reserva online — em breve)" />
      </div>

      {selected && (
        <BookSlotDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          date={date}
          slot={selected}
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
  onBook,
}: {
  cell: CourtGridSlotCell | undefined;
  courtName: string;
  onBook: (cell: CourtGridSlotCell) => void;
}) {
  if (!cell) {
    return <div className="h-12 flex items-center justify-center text-[var(--text-disabled)]">—</div>;
  }

  if (cell.status === "free") {
    return (
      <button
        type="button"
        onClick={() => onBook(cell)}
        aria-label={`Marcar ${courtName} às ${cell.startTimeHHMM}`}
        className="w-full h-12 px-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-white text-left hover:border-[var(--accent)] hover:bg-[var(--accent-tint-soft)] transition-colors"
      >
        <span className="block text-[11px] font-semibold text-[var(--text-2)]">Livre</span>
        <span className="block text-[11px] tabular-nums text-[var(--text-3)]">
          {formatCentsToBRL(cell.priceInCents)}
        </span>
      </button>
    );
  }

  if (cell.status === "reserved") {
    return (
      <div className="w-full h-12 px-2 rounded-[var(--radius-control)] border border-[var(--warning)] flex flex-col justify-center">
        <span className="text-[11px] font-semibold text-[var(--warning)]">Reservado</span>
        <span className="text-[11px] text-[var(--text-3)] truncate">{cell.customerName ?? "Online"}</span>
      </div>
    );
  }

  // Rateio entre múltiplas comandas (PDV-05)
  if (cell.splitParticipants && cell.splitParticipants.length > 0) {
    const names = cell.splitParticipants
      .map((p) => p.customerName ?? "Balcão")
      .join(" | ");

    const firstComandaId = cell.splitParticipants.find((p) => p.comandaId)?.comandaId;

    const inner = (
      <div
        className="w-full h-12 px-2 rounded-[var(--radius-control)] border border-purple-300 bg-purple-50 flex flex-col justify-center"
        title={`Rateio entre: ${names}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">
            Rateio ({cell.splitParticipants.length})
          </span>
          <span className="text-[9px] font-semibold text-purple-600">
            {formatCentsToBRL(cell.priceInCents)}
          </span>
        </div>
        <span className="text-[11px] font-medium text-purple-900 truncate">
          {names}
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

  // booked (Ocupado simples)
  const inner = (
    <div className="w-full h-12 px-2 rounded-[var(--radius-control)] border border-[var(--accent)] bg-[var(--accent-tint)] flex flex-col justify-center">
      <span className="text-[11px] font-semibold text-[var(--accent-hover)]">Ocupado</span>
      <span className="text-[11px] text-[var(--text-2)] truncate">{cell.customerName ?? "Venda Balcão"}</span>
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
