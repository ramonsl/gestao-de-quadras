import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { getTimeSlots } from "@gestao-de-quadras/core/courts/court-time-slot.service";
import type { CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const DAYS_OF_WEEK = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function FaixasHorariasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const ctx = { db, schemaName: `tenant_${session.user.tenantSlug}`, actorUserId: session.user.id };
  const courts = await getCourtsByTenant(ctx);

  const slotsMap = new Map<string, CourtTimeSlot[]>();
  for (const court of courts) {
    const slots = await getTimeSlots(ctx, court.id);
    slotsMap.set(court.id, slots);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Faixas Horárias</h1>
        <Link href="/admin/faixas-horarias/nova">
          <Button>Nova Faixa</Button>
        </Link>
      </div>

      {courts.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>Cadastre quadras primeiro</p>
        </div>
      ) : (
        <div className="space-y-6">
          {courts.map((court) => {
            const slots = slotsMap.get(court.id) || [];
            const slotsByDay = new Map<number, CourtTimeSlot[]>();

            slots.forEach((slot) => {
              const arr = slotsByDay.get(slot.dayOfWeek) ?? [];
              arr.push(slot);
              slotsByDay.set(slot.dayOfWeek, arr);
            });

            return (
              <div key={court.id} className="border rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">{court.name}</h2>
                {slots.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma faixa hoária cadastrada</p>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day, dayIndex) => {
                      const daySlots = slotsByDay.get(dayIndex) || [];
                      return (
                        <div key={dayIndex} className="border rounded p-2">
                          <h3 className="font-semibold text-sm mb-2">{day}</h3>
                          {daySlots.length === 0 ? (
                            <p className="text-xs text-gray-400">Sem faixas</p>
                          ) : (
                            <div className="space-y-1">
                              {daySlots.map((slot) => (
                                <div key={slot.id} className="text-xs bg-blue-50 p-1 rounded">
                                  <div className="font-medium">
                                    {slot.startTimeHHMM} - {slot.endTimeHHMM}
                                  </div>
                                  <div className="text-gray-600">
                                    {slot.durationMinutes}min
                                  </div>
                                  <div className="font-semibold text-blue-600">
                                    {formatCurrency(slot.priceInCents)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
