"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

/** Soma `days` a uma data YYYY-MM-DD sem depender de timezone. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayOfWeek(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  });
}

function formatDateFormatted(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DateNavigator({ date, minDate }: { date: string; minDate: string }) {
  const router = useRouter();
  const canGoBack = date > minDate;

  function go(next: string) {
    router.push(`/quadras/grade?date=${next}`);
  }

  const isToday = date === minDate;

  return (
    <div className="flex items-center gap-3 bg-[var(--bg-sunken)] border border-[var(--border)] px-3 py-1.5 rounded-full shadow-2xs">
      <button
        type="button"
        onClick={() => canGoBack && go(shiftDate(date, -1))}
        disabled={!canGoBack}
        aria-label="Dia anterior"
        className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-gray-100 hover:text-[var(--accent)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Destaque Centralizado da Data */}
      <div className="flex items-center gap-2.5 px-2">
        <Calendar className="size-4 text-[var(--accent)] shrink-0" />
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-extrabold uppercase text-[var(--text-1)] tracking-wide">
            {formatDayOfWeek(date)}
          </span>
          <span className="text-xs font-semibold text-[var(--text-2)] tabular-nums">
            {formatDateFormatted(date)}
          </span>
          {isToday && (
            <span className="text-[10px] font-bold text-white bg-[var(--accent)] px-2 py-0.5 rounded-full uppercase tracking-wider ml-1">
              Hoje
            </span>
          )}
        </div>

        {/* Input invisível para date picker nativo ao clicar */}
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => {
            const v = e.target.value;
            if (v && v >= minDate) go(v);
          }}
          aria-label="Data da grade"
          className="sr-only"
          id="date-picker-hidden"
        />
      </div>

      <button
        type="button"
        onClick={() => go(shiftDate(date, 1))}
        aria-label="Próximo dia"
        className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-gray-100 hover:text-[var(--accent)] transition-all"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
