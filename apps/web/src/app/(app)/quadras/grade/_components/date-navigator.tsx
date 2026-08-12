"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Soma `days` a uma data YYYY-MM-DD sem depender de timezone. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "short",
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

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => canGoBack && go(shiftDate(date, -1))}
        disabled={!canGoBack}
        aria-label="Dia anterior"
        className="inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-control)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg-sunken)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="size-4" />
      </button>

      <input
        type="date"
        value={date}
        min={minDate}
        onChange={(e) => {
          const v = e.target.value;
          if (v && v >= minDate) go(v);
        }}
        aria-label="Data da grade"
        className="h-9 px-3 text-sm font-medium text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
      />

      <span className="hidden sm:inline text-[13px] text-[var(--text-3)] capitalize min-w-[140px]">
        {formatLabel(date)}
      </span>

      <button
        type="button"
        onClick={() => go(shiftDate(date, 1))}
        aria-label="Próximo dia"
        className="inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-control)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg-sunken)]"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
