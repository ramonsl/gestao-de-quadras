"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCentsToBRL } from "@/lib/currency";
import type { LocalCustomer } from "@gestao-de-quadras/core/customers/customer.service";
import type { CustomerMembershipView, MembershipPlanView } from "@gestao-de-quadras/core/membership";
import {
  createCustomerMembershipAction,
  deactivateMembershipPlanAction,
  endCustomerMembershipAction,
  saveMembershipPlanAction,
  updateMembershipPlanAction,
  type MembershipActionState,
} from "../_actions/membership.actions";

const INITIAL_STATE: MembershipActionState = { status: "idle" };

function Feedback({ state }: { state: MembershipActionState }) {
  if (state.status === "idle") return null;
  return (
    <p className={state.status === "success" ? "text-sm text-[var(--success)]" : "text-sm text-[var(--danger)]"}>
      {state.message}
    </p>
  );
}

const fieldClass = "space-y-1.5";

export function MembershipDashboard({
  plans,
  memberships,
  customers,
}: {
  plans: MembershipPlanView[];
  memberships: CustomerMembershipView[];
  customers: LocalCustomer[];
}) {
  const [planState, planAction, planPending] = useActionState(saveMembershipPlanAction, INITIAL_STATE);
  const [membershipState, membershipAction, membershipPending] = useActionState(
    createCustomerMembershipAction,
    INITIAL_STATE
  );
  const activePlans = plans.filter((plan) => plan.isActive);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">FIL-01</p>
        <h1 className="text-2xl font-semibold text-[var(--text-1)]">Planos e filiações</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">Configure benefícios e vincule clientes existentes da arena.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Novo plano</CardTitle></CardHeader>
          <CardContent>
            <form action={planAction} className="grid gap-4 sm:grid-cols-2">
              <div className={`${fieldClass} sm:col-span-2`}><Label htmlFor="name">Nome</Label><Input id="name" name="name" required /></div>
              <div className={`${fieldClass} sm:col-span-2`}><Label htmlFor="description">Descrição</Label><Textarea id="description" name="description" required /></div>
              <div className={fieldClass}><Label htmlFor="cyclePriceCents">Valor do ciclo (centavos)</Label><Input id="cyclePriceCents" name="cyclePriceCents" type="number" min="1" step="1" required /></div>
              <div className={fieldClass}><Label htmlFor="billingPeriod">Periodicidade</Label><Select id="billingPeriod" name="billingPeriod" defaultValue="monthly"><option value="monthly">Mensal</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></Select></div>
              <div className={fieldClass}><Label htmlFor="productDiscountPercent">Desconto em produtos (%)</Label><Input id="productDiscountPercent" name="productDiscountPercent" type="number" min="0" max="100" defaultValue="0" required /></div>
              <div className={fieldClass}><Label htmlFor="courtRentalDiscountPercent">Desconto em locações (%)</Label><Input id="courtRentalDiscountPercent" name="courtRentalDiscountPercent" type="number" min="0" max="100" defaultValue="0" required /></div>
              <div className={fieldClass}><Label htmlFor="classPackageDiscountPercent">Desconto em pacotes de aula (%)</Label><Input id="classPackageDiscountPercent" name="classPackageDiscountPercent" type="number" min="0" max="100" defaultValue="0" required /></div>
              <div className={fieldClass}><Label htmlFor="productCategories">Categorias elegíveis</Label><Input id="productCategories" name="productCategories" placeholder="Bebidas, Lanches" /></div>
              <div className="sm:col-span-2 flex items-center justify-between gap-3"><Feedback state={planState} /><Button type="submit" disabled={planPending}>{planPending ? "Salvando..." : "Criar plano"}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vincular cliente</CardTitle></CardHeader>
          <CardContent>
            <form action={membershipAction} className="space-y-4">
              <div className={fieldClass}><Label htmlFor="customerId">Cliente</Label><Select id="customerId" name="customerId" required defaultValue=""><option value="" disabled>Selecione um cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.whatsapp}</option>)}</Select></div>
              <div className={fieldClass}><Label htmlFor="membershipPlanId">Plano ativo</Label><Select id="membershipPlanId" name="membershipPlanId" required defaultValue=""><option value="" disabled>Selecione um plano</option>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className={fieldClass}><Label htmlFor="startsOn">Início</Label><Input id="startsOn" name="startsOn" type="date" required /></div><div className={fieldClass}><Label htmlFor="endsOn">Término (opcional)</Label><Input id="endsOn" name="endsOn" type="date" /></div></div>
              <div className="flex items-center justify-between gap-3"><Feedback state={membershipState} /><Button type="submit" disabled={membershipPending || activePlans.length === 0}>{membershipPending ? "Vinculando..." : "Vincular cliente"}</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Planos cadastrados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {plans.length === 0 ? <p className="text-sm text-[var(--text-3)]">Nenhum plano cadastrado.</p> : plans.map((plan) => (
            <div key={plan.id} className="rounded-[var(--radius-control)] border border-[var(--border)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><div className="flex items-center gap-2"><p className="font-semibold text-[var(--text-1)]">{plan.name}</p><span className={plan.isActive ? "text-xs text-[var(--success)]" : "text-xs text-[var(--text-3)]"}>{plan.isActive ? "Ativo" : "Inativo"}</span></div><p className="text-sm text-[var(--text-3)]">{formatCentsToBRL(plan.cyclePriceCents)} · {plan.billingPeriod} · Produtos {plan.productDiscountPercent}% · Locação {plan.courtRentalDiscountPercent}% · Pacotes {plan.classPackageDiscountPercent}%</p><p className="text-xs text-[var(--text-3)]">Categorias: {plan.productCategories.join(", ") || "nenhuma"}</p></div>
                {plan.isActive && <form action={deactivateMembershipPlanAction}><input type="hidden" name="planId" value={plan.id} /><Button type="submit" variant="outline" size="sm">Inativar</Button></form>}
              </div>
              {plan.isActive && (
                <details className="mt-3 border-t border-[var(--border)] pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">Editar configuração</summary>
                  <form action={updateMembershipPlanAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={plan.id} />
                    <div className={fieldClass}><Label>Nome</Label><Input name="name" defaultValue={plan.name} required /></div>
                    <div className={fieldClass}><Label>Valor do ciclo (centavos)</Label><Input name="cyclePriceCents" type="number" min="1" defaultValue={plan.cyclePriceCents} required /></div>
                    <div className={`${fieldClass} sm:col-span-2`}><Label>Descrição</Label><Textarea name="description" defaultValue={plan.description} required /></div>
                    <div className={fieldClass}><Label>Periodicidade</Label><Select name="billingPeriod" defaultValue={plan.billingPeriod}><option value="monthly">Mensal</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></Select></div>
                    <div className={fieldClass}><Label>Categorias elegíveis</Label><Input name="productCategories" defaultValue={plan.productCategories.join(", ")} /></div>
                    <div className={fieldClass}><Label>Produtos (%)</Label><Input name="productDiscountPercent" type="number" min="0" max="100" defaultValue={plan.productDiscountPercent} required /></div>
                    <div className={fieldClass}><Label>Locações (%)</Label><Input name="courtRentalDiscountPercent" type="number" min="0" max="100" defaultValue={plan.courtRentalDiscountPercent} required /></div>
                    <div className={fieldClass}><Label>Pacotes de aula (%)</Label><Input name="classPackageDiscountPercent" type="number" min="0" max="100" defaultValue={plan.classPackageDiscountPercent} required /></div>
                    <div className="flex items-end"><Button type="submit">Salvar alterações</Button></div>
                  </form>
                </details>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico de filiações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {memberships.length === 0 ? <p className="text-sm text-[var(--text-3)]">Nenhuma filiação cadastrada.</p> : memberships.map((membership) => (
            <div key={membership.id} className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--border)] p-4 md:flex-row md:items-center md:justify-between">
              <div><p className="font-semibold text-[var(--text-1)]">{membership.customerName} · {membership.membershipPlanName}</p><p className="text-sm text-[var(--text-3)]">{membership.startsOn} até {membership.endsOn ?? "sem término"} · {membership.status === "ended" ? "Encerrada" : membership.eligibleToday ? "Benefício vigente" : "Aguardando vigência"}</p></div>
              {membership.status === "active" && <form action={endCustomerMembershipAction}><input type="hidden" name="membershipId" value={membership.id} /><Button type="submit" variant="outline" size="sm">Encerrar</Button></form>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
