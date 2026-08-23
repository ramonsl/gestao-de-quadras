"use client";

import { useActionState, useEffect } from "react";
import type { PointsSettingsView } from "@gestao-de-quadras/core/points";
import {
  upsertPointsSettingsAction,
  type PointsSettingsFormState,
} from "../_actions/points-settings.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Award, Zap, ShieldCheck, Timer } from "lucide-react";

interface PointsSettingsFormProps {
  initialConfig: PointsSettingsView;
}

const initialState: PointsSettingsFormState = { status: "idle" };

export function PointsSettingsForm({ initialConfig }: PointsSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(upsertPointsSettingsAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      const el = document.getElementById("pts-config-success");
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [state]);

  const fieldError = (field: string): string | undefined =>
    state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-1)]">Pontos / Cashback</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Configure o programa de fidelidade da arena: taxas de acúmulo por categoria, regras de
          resgate, participação e expiração de pontos.
        </p>
      </div>

      {state.status === "success" && (
        <div
          id="pts-config-success"
          className="rounded-[var(--radius-control)] border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "var(--success-border)",
            backgroundColor: "var(--success-bg)",
            color: "var(--success)",
          }}
        >
          Configurações salvas com sucesso.
        </div>
      )}

      {state.status === "error" && !state.fieldErrors && (
        <div
          className="rounded-[var(--radius-control)] px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {state.message}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* ── Programa Ativo ────────────────────────────────── */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--accent)]" />
            Programa de Pontos
          </h2>

          <div className="flex items-center gap-3">
            <Switch
              id="enabled"
              name="enabled"
              defaultChecked={initialConfig.enabled}
            />
            <div>
              <Label htmlFor="enabled" className="cursor-pointer">
                Ativar programa de pontos / cashback
              </Label>
              <p className="text-xs text-[var(--text-3)]">
                Quando desativado, o módulo de pontos fica invisível no PDV. Você pode
                pré-configurar as regras antes de ativar.
              </p>
            </div>
          </div>
        </div>

        {/* ── Taxas de Acúmulo ──────────────────────────────── */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-[var(--accent)]" />
            Taxas de Acúmulo
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="earnRateCentsPerPoint">Taxa padrão (centavos por ponto)</Label>
            <Input
              id="earnRateCentsPerPoint"
              name="earnRateCentsPerPoint"
              type="number"
              min={1}
              defaultValue={initialConfig.earnRateCentsPerPoint}
              className="w-48"
            />
            <p className="text-xs text-[var(--text-3)]">
              Quantos centavos gastos para ganhar 1 ponto. Ex.: 100 = R$ 1,00 por ponto.
              Esta taxa é usada como fallback quando uma categoria não tem taxa própria.
            </p>
            {fieldError("earnRateCentsPerPoint") && (
              <p className="text-xs text-[var(--danger)]">{fieldError("earnRateCentsPerPoint")}</p>
            )}
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-2)] mb-3">
              Taxas por categoria (opcional — deixe vazio para usar a taxa padrão acima; 0 = sem acúmulo)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="earnRateCopa">Copa (produtos)</Label>
                <Input
                  id="earnRateCopa"
                  name="earnRateCopa"
                  type="number"
                  min={0}
                  defaultValue={initialConfig.earnRateCopa ?? ""}
                  placeholder="Padrão"
                />
                {fieldError("earnRateCopa") && (
                  <p className="text-xs text-[var(--danger)]">{fieldError("earnRateCopa")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="earnRateCourtRental">Locação de Quadras</Label>
                <Input
                  id="earnRateCourtRental"
                  name="earnRateCourtRental"
                  type="number"
                  min={0}
                  defaultValue={initialConfig.earnRateCourtRental ?? ""}
                  placeholder="Padrão"
                />
                {fieldError("earnRateCourtRental") && (
                  <p className="text-xs text-[var(--danger)]">{fieldError("earnRateCourtRental")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="earnRateClassPackage">Pacotes de Aulas</Label>
                <Input
                  id="earnRateClassPackage"
                  name="earnRateClassPackage"
                  type="number"
                  min={0}
                  defaultValue={initialConfig.earnRateClassPackage ?? ""}
                  placeholder="Padrão"
                />
                {fieldError("earnRateClassPackage") && (
                  <p className="text-xs text-[var(--danger)]">{fieldError("earnRateClassPackage")}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Regras de Resgate ─────────────────────────────── */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            Regras de Resgate
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="redemptionPointsPerReal">Pontos por R$ 1,00 de desconto</Label>
              <Input
                id="redemptionPointsPerReal"
                name="redemptionPointsPerReal"
                type="number"
                min={1}
                defaultValue={initialConfig.redemptionPointsPerReal}
                className="w-full"
              />
              <p className="text-xs text-[var(--text-3)]">
                Ex.: 100 = 100 pontos para abater R$ 1,00.
              </p>
              {fieldError("redemptionPointsPerReal") && (
                <p className="text-xs text-[var(--danger)]">{fieldError("redemptionPointsPerReal")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxRedemptionPercentage">Limite de abatimento na comanda (%)</Label>
              <Input
                id="maxRedemptionPercentage"
                name="maxRedemptionPercentage"
                type="number"
                min={0}
                max={100}
                defaultValue={initialConfig.maxRedemptionPercentage}
                className="w-full"
              />
              <p className="text-xs text-[var(--text-3)]">
                Porcentagem máxima do total da comanda que pode ser paga com pontos.
              </p>
              {fieldError("maxRedemptionPercentage") && (
                <p className="text-xs text-[var(--danger)]">{fieldError("maxRedemptionPercentage")}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
            <Switch
              id="allowPartialRedemption"
              name="allowPartialRedemption"
              defaultChecked={initialConfig.allowPartialRedemption}
            />
            <div>
              <Label htmlFor="allowPartialRedemption" className="cursor-pointer">
                Permitir resgate parcial
              </Label>
              <p className="text-xs text-[var(--text-3)]">
                Quando desativado, o cliente só pode resgatar pontos se cobrir 100% do valor da
                comanda (respeitando o limite de abatimento acima).
              </p>
            </div>
          </div>
        </div>

        {/* ── Participação e Expiração ──────────────────────── */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
            <Timer className="w-4 h-4 text-[var(--accent)]" />
            Participação e Expiração
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="allowedParticipants">Quem participa do programa</Label>
            <div className="relative w-72">
              <Select
                id="allowedParticipants"
                name="allowedParticipants"
                defaultValue={initialConfig.allowedParticipants}
              >
                <option value="all">Todos os clientes cadastrados</option>
                <option value="affiliates_only">Apenas filiados ativos</option>
              </Select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg
                  className="h-4 w-4 text-[var(--text-3)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-[var(--text-3)]">
              Se &quot;Apenas filiados ativos&quot;, todos acumulam pontos, mas somente filiados ativos podem resgatar.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expirationDays">Expiração de pontos (dias)</Label>
            <Input
              id="expirationDays"
              name="expirationDays"
              type="number"
              min={1}
              defaultValue={initialConfig.expirationDays}
              className="w-48"
            />
            <p className="text-xs text-[var(--text-3)]">
              Pontos expiram automaticamente após este período sem uso. Ex.: 180 = 6 meses.
            </p>
            {fieldError("expirationDays") && (
              <p className="text-xs text-[var(--danger)]">{fieldError("expirationDays")}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="min-w-[160px]">
            {isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
