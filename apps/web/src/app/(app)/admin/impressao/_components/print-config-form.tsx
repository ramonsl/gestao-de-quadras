"use client";

import { useActionState, useEffect } from "react";
import type { PrintConfigView } from "@gestao-de-quadras/core/print";
import { upsertPrintConfigAction, type PrintConfigFormState } from "../_actions/print-config.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface PrintConfigFormProps {
  initialConfig: PrintConfigView;
}

const initialState: PrintConfigFormState = { status: "idle" };

export function PrintConfigForm({ initialConfig }: PrintConfigFormProps) {
  const [state, formAction, isPending] = useActionState(upsertPrintConfigAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      const el = document.getElementById("print-config-success");
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [state]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-1)]">Configurações de Impressão Térmica</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Define o tamanho do papel, comportamento de impressão automática e textos
          exibidos nos comprovantes de comanda.
        </p>
      </div>

      {state.status === "success" && (
        <div
          id="print-config-success"
          className="rounded-[var(--radius-control)] border px-4 py-3 text-sm font-medium"
          style={{ borderColor: "var(--success-border)", backgroundColor: "var(--success-bg)", color: "var(--success)" }}
        >
          Configurações salvas com sucesso.
        </div>
      )}

      {state.status === "error" && (
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
        {/* Tamanho do papel */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)] border-b border-[var(--border)] pb-2">
            Impressora
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="paperSize">Tamanho do papel</Label>
            <div className="relative w-48">
              <Select
                id="paperSize"
                name="paperSize"
                defaultValue={initialConfig.paperSize}
              >
                <option value="80mm">80mm (padrão)</option>
                <option value="58mm">58mm</option>
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
              Afeta as margens e a largura dos comprovantes ao imprimir.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="autoPrintProductionTickets"
              name="autoPrintProductionTickets"
              defaultChecked={initialConfig.autoPrintProductionTickets}
            />
            <div>
              <Label htmlFor="autoPrintProductionTickets" className="cursor-pointer">
                Imprimir fichas de produção automaticamente
              </Label>
              <p className="text-xs text-[var(--text-3)]">
                Quando ativo, o PDV aciona a impressão imediatamente após lançar itens,
                sem exigir confirmação adicional.
              </p>
            </div>
          </div>
        </div>

        {/* Cabeçalho e Rodapé */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-1)] border-b border-[var(--border)] pb-2">
            Textos do Comprovante
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="receiptHeader">Cabeçalho</Label>
            <Textarea
              id="receiptHeader"
              name="receiptHeader"
              rows={3}
              defaultValue={initialConfig.receiptHeader ?? ""}
              placeholder={"Arena Beach Tennis\nCNPJ 12.345.678/0001-00"}
              maxLength={500}
            />
            <p className="text-xs text-[var(--text-3)]">
              Exibido no topo dos comprovantes. Quebras de linha são preservadas.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receiptFooter">Rodapé</Label>
            <Textarea
              id="receiptFooter"
              name="receiptFooter"
              rows={3}
              defaultValue={initialConfig.receiptFooter ?? ""}
              placeholder="Obrigado pela preferência!"
              maxLength={500}
            />
            <p className="text-xs text-[var(--text-3)]">
              Exibido no final dos comprovantes. Quebras de linha são preservadas.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isPending}
            className="min-w-[140px]"
          >
            {isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
