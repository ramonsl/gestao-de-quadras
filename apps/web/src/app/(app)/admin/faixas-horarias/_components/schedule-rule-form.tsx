"use client";

import React, { useActionState, useRef } from "react";
import { saveScheduleRuleAction } from "../_actions/save-schedule-rule.action";
import { generateSlotsFromRule } from "@gestao-de-quadras/core/courts/court-time-slot.service";
import type { Court } from "@gestao-de-quadras/db/schema";
import Link from "next/link";
import { AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  courts: Court[];
}

type FormState =
  | { status: "idle" }
  | { status: "success"; slotsCreated: number }
  | { status: "error"; error: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS = [
  { value: 0, label: "Dom", full: "Domingo" },
  { value: 1, label: "Seg", full: "Segunda" },
  { value: 2, label: "Ter", full: "Terça" },
  { value: 3, label: "Qua", full: "Quarta" },
  { value: 4, label: "Qui", full: "Quinta" },
  { value: 5, label: "Sex", full: "Sexta" },
  { value: 6, label: "Sáb", full: "Sábado" },
];

const LABEL_CLS =
  "block text-xs font-semibold text-[var(--text-2)] mb-1.5 uppercase tracking-wide";
const INPUT_CLS =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

// ---------------------------------------------------------------------------
// Sub-component: preview grid
// ---------------------------------------------------------------------------

function PreviewPanel({
  preview,
  previewError,
  selectedDays,
  opening,
  closing,
  price,
  formState,
}: {
  preview: ReturnType<typeof generateSlotsFromRule>;
  previewError: string;
  selectedDays: number[];
  opening: string;
  closing: string;
  price: string;
  formState: FormState;
}) {
  const totalSlots = preview.length * selectedDays.length;
  const priceNum = parseFloat(price) || 0;
  const totalRevenue = totalSlots * priceNum;

  return (
    <aside className="flex flex-col gap-4">
      {/* Sumário */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-1)] mb-3">Resumo</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[var(--bg-sunken)] rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-[var(--accent)]">{preview.length}</div>
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide mt-0.5">
              blocos/dia
            </div>
          </div>
          <div className="bg-[var(--bg-sunken)] rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-[var(--text-1)]">{selectedDays.length}</div>
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide mt-0.5">
              dia(s)
            </div>
          </div>
          <div className="bg-[var(--accent-tint-soft)] rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-[var(--accent)]">{totalSlots}</div>
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide mt-0.5">
              total slots
            </div>
          </div>
        </div>
        {opening && closing && priceNum > 0 && preview.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
            <span className="text-[var(--text-3)]">
              {opening} – {closing} · R${" "}
              {priceNum.toFixed(2).replace(".", ",")} / bloco
            </span>
            <span className="font-bold text-[var(--text-1)]">
              Potencial: R$ {totalRevenue.toFixed(2).replace(".", ",")}
            </span>
          </div>
        )}
      </div>

      {/* Preview dos slots */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-1)]">Preview da Grade</h2>
          {preview.length > 0 && (
            <span className="text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-tint-soft)] px-2 py-0.5 rounded-full">
              {preview.length} blocos × {selectedDays.length} dia(s)
            </span>
          )}
        </div>

        {previewError ? (
          <div className="flex items-center gap-2 p-3 rounded-[var(--radius-card)] bg-[var(--danger-bg)] border border-[var(--danger-border)]">
            <AlertTriangle className="size-4 text-[var(--danger)] shrink-0" aria-hidden />
            <p className="text-xs text-[var(--danger)]">{previewError}</p>
          </div>
        ) : preview.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <Clock className="size-8 mb-2 text-[var(--text-disabled)]" aria-hidden />
            <p className="text-xs text-[var(--text-3)]">
              Preencha o horário e o preço<br />para ver o preview dos blocos.
            </p>
          </div>
        ) : (
          <div
            className="flex-1 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 340px)", minHeight: "120px" }}
          >
            {/* Grade de slots organizada em colunas por dia */}
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min(selectedDays.length, 5)}, 1fr)`,
              }}
            >
              {/* Cabeçalho de dias */}
              {selectedDays
                .slice()
                .sort((a, b) => a - b)
                .map((d) => (
                  <div
                    key={`hd-${d}`}
                    className="text-[10px] font-bold text-[var(--text-3)] text-center uppercase tracking-wide pb-1"
                  >
                    {DAYS[d].label}
                  </div>
                ))}

              {/* Slots por coluna de dia */}
              {preview.map((slot) =>
                selectedDays
                  .slice()
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <div
                      key={`${d}-${slot.startTimeHHMM}`}
                      className="px-2 py-1.5 rounded bg-[var(--accent-tint-soft)] border border-[var(--accent-tint)] text-center"
                    >
                      <div className="text-[11px] font-semibold text-[var(--text-1)] leading-tight">
                        {slot.startTimeHHMM}
                      </div>
                      <div className="text-[9px] text-[var(--text-3)] leading-tight">
                        – {slot.endTimeHHMM}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Fallback: lista simples quando muitos dias */}
            {selectedDays.length > 5 && (
              <p className="text-[10px] text-[var(--text-3)] mt-2 text-center">
                Mostrando slots para {selectedDays.length} dia(s) — {preview.length} blocos cada.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Feedback */}
      {formState.status === "success" && (
        <div className="p-3 rounded-[var(--radius-card)] bg-[var(--success-bg)] border border-[var(--success-border)] text-sm text-[var(--success)] flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Grade salva! {formState.slotsCreated} slot(s) criado(s).
        </div>
      )}
      {formState.status === "error" && (
        <div className="p-3 rounded-[var(--radius-card)] bg-[var(--danger-bg)] border border-[var(--danger-border)] text-sm text-[var(--danger)] flex items-center gap-2">
          <XCircle className="size-4 shrink-0" aria-hidden />
          {formState.error}
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScheduleRuleForm({ courts }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedDays, setSelectedDays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [opening, setOpening] = React.useState("08:00");
  const [closing, setClosing] = React.useState("22:00");
  const [price, setPrice] = React.useState("35.00");
  const [monthlyPrice, setMonthlyPrice] = React.useState("");

  const [formState, submitAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await saveScheduleRuleAction(formData);
      if ("success" in result) {
        return { status: "success", slotsCreated: result.slotsCreated };
      }
      return { status: "error", error: result.error };
    },
    { status: "idle" }
  );

  // Preview calculado em tempo real
  let preview: ReturnType<typeof generateSlotsFromRule> = [];
  let previewError = "";
  try {
    const priceInCents = Math.round(parseFloat(price) * 100);
    if (priceInCents > 0) {
      preview = generateSlotsFromRule(opening, closing, priceInCents);
    }
  } catch (e) {
    previewError = e instanceof Error ? e.message : "Intervalo inválido";
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectWeekdays = () => setSelectedDays([1, 2, 3, 4, 5]);
  const selectAll = () => setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  const clearAll = () => setSelectedDays([]);

  if (courts.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
        Nenhuma quadra cadastrada.{" "}
        <Link href="/admin/quadras/nova" className="text-[var(--accent)] underline">
          Cadastre uma quadra primeiro
        </Link>
        .
      </div>
    );
  }

  return (
    // Layout split: 55% form | 45% preview
    <div className="flex gap-5 items-start min-h-0">
      {/* ── Coluna esquerda: formulário ── */}
      <form
        ref={formRef}
        action={submitAction}
        className="flex-[55] min-w-0 space-y-4"
      >
        {/* 1. Quadra */}
        <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-1)]">1. Quadra</h2>
          <div>
            <label htmlFor="courtId" className={LABEL_CLS}>
              Selecione a quadra *
            </label>
            <select
              id="courtId"
              name="courtId"
              className={INPUT_CLS}
              defaultValue={courts[0]?.id}
              required
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.modality})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Dias da semana */}
        <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-1)]">2. Dias da Semana</h2>
            <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
              <button type="button" onClick={selectWeekdays} className="hover:underline">
                Dias úteis
              </button>
              <span className="text-[var(--border)]">·</span>
              <button type="button" onClick={selectAll} className="hover:underline">
                Todos
              </button>
              <span className="text-[var(--border)]">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="hover:underline text-[var(--text-3)]"
              >
                Limpar
              </button>
            </div>
          </div>
          <p className="text-xs text-[var(--text-3)]">
            Selecione os dias em que este horário e preço se aplicam.
          </p>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day) => {
              const active = selectedDays.includes(day.value);
              return (
                <label
                  key={day.value}
                  title={day.full}
                  className={`
                    flex flex-col items-center justify-center w-14 h-12
                    rounded-[var(--radius-button)] cursor-pointer
                    text-sm font-semibold border transition-all duration-[150ms] select-none
                    ${
                      active
                        ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                        : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    name="days"
                    value={day.value}
                    checked={active}
                    onChange={() => toggleDay(day.value)}
                    className="sr-only"
                  />
                  <span className="text-[11px] font-bold">{day.label}</span>
                  <span className="text-[9px] opacity-60 font-normal">{day.full[0]}</span>
                </label>
              );
            })}
          </div>
          {selectedDays.length === 0 && (
            <p className="text-xs text-[var(--danger)]">Selecione pelo menos um dia.</p>
          )}
        </div>

        {/* 3. Horário e Preço */}
        <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)]">3. Horário e Preço</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="openingHHMM" className={LABEL_CLS}>
                Abertura *
              </label>
              <input
                type="time"
                id="openingHHMM"
                name="openingHHMM"
                step="1800"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className={INPUT_CLS}
                required
              />
            </div>
            <div>
              <label htmlFor="closingHHMM" className={LABEL_CLS}>
                Fechamento *
              </label>
              <input
                type="time"
                id="closingHHMM"
                name="closingHHMM"
                step="1800"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                className={INPUT_CLS}
                required
              />
            </div>
            <div>
              <label htmlFor="pricePerSlot" className={LABEL_CLS}>
                Valor Avulso / 30 min (R$) *
              </label>
              <input
                type="number"
                id="pricePerSlot"
                name="pricePerSlot"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="35,00"
                className={INPUT_CLS}
                required
              />
              <p className="mt-1 text-[11px] text-[var(--text-3)]">
                1h = 2 blocos · 1h30 = 3 blocos
              </p>
            </div>
          </div>

          {/* Tarifa Mensalista */}
          <div>
            <label htmlFor="monthlyPricePerSlot" className={LABEL_CLS}>
              Tarifa Mensalista / 30 min (R$)
              <span className="ml-2 text-[10px] font-normal text-[var(--text-3)] normal-case tracking-normal">
                Opcional — valor reduzido para contratos mensais (CAD-09)
              </span>
            </label>
            <input
              type="number"
              id="monthlyPricePerSlot"
              name="monthlyPricePerSlot"
              step="0.01"
              min="0.01"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              placeholder="25,00 (opcional)"
              className={INPUT_CLS}
            />
            {monthlyPrice && parseFloat(monthlyPrice) > 0 && (
              <p className="mt-1 text-[11px] text-[var(--accent)]">
                Mensalista 1h = {((parseFloat(monthlyPrice) || 0) * 2).toFixed(2).replace(".", ",")} · 1h30 = {((parseFloat(monthlyPrice) || 0) * 3).toFixed(2).replace(".", ",")}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            id="btn-salvar-grade"
            type="submit"
            disabled={isPending || selectedDays.length === 0 || preview.length === 0}
            className="h-9 px-5 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms] disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {isPending ? "Salvando…" : "Salvar configuração"}
          </button>
          <Link
            href="/admin/faixas-horarias"
            className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {/* ── Coluna direita: preview ao vivo ── */}
      <div className="flex-[45] min-w-0 sticky top-[22px]">
        <PreviewPanel
          preview={preview}
          previewError={previewError}
          selectedDays={selectedDays}
          opening={opening}
          closing={closing}
          price={price}
          formState={formState}
        />
      </div>
    </div>
  );
}
