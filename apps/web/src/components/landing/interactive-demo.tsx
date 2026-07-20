"use client";

import React, { useState } from "react";

type DemoTab = "grade" | "pdv" | "crm";

interface CourtSlot {
  time: string;
  courts: {
    name: string;
    type: "Padel" | "Beach Tennis";
    status: "free" | "booked" | "occupied";
    player?: string;
    price: number;
  }[];
}

export function LandingInteractiveDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>("grade");
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<string | null>(null);

  // Mock data for live court grid
  const courtSlots: CourtSlot[] = [
    {
      time: "18:00",
      courts: [
        { name: "Quadra 1", type: "Padel", status: "occupied", player: "Rodrigo & Felipe", price: 120 },
        { name: "Quadra 2", type: "Padel", status: "booked", player: "Ana & Camila", price: 120 },
        { name: "Quadra 3", type: "Beach Tennis", status: "free", price: 90 },
        { name: "Quadra 4", type: "Beach Tennis", status: "occupied", player: "Turma do Beach", price: 90 },
      ],
    },
    {
      time: "19:00",
      courts: [
        { name: "Quadra 1", type: "Padel", status: "booked", player: "Marcos & Gabriel", price: 140 },
        { name: "Quadra 2", type: "Padel", status: "free", price: 140 },
        { name: "Quadra 3", type: "Beach Tennis", status: "occupied", player: "Juliana & Mariana", price: 100 },
        { name: "Quadra 4", type: "Beach Tennis", status: "booked", player: "Carlos Padel", price: 100 },
      ],
    },
    {
      time: "20:00",
      courts: [
        { name: "Quadra 1", type: "Padel", status: "occupied", player: "Desafio Interno", price: 140 },
        { name: "Quadra 2", type: "Padel", status: "occupied", player: "Luciano & Pedro", price: 140 },
        { name: "Quadra 3", type: "Beach Tennis", status: "free", price: 100 },
        { name: "Quadra 4", type: "Beach Tennis", status: "free", price: 100 },
      ],
    },
  ];

  // Mock items for PDV tab
  const mockComandaItems = [
    { id: 1, name: "Locação de Quadra (1h Padel)", qty: 1, price: 14000 },
    { id: 2, name: "Água Mineral 500ml", qty: 3, price: 600 },
    { id: 3, name: "Isotônico Gatorade 500ml", qty: 2, price: 1200 },
    { id: 4, name: "Aluguel Raquete Varlion", qty: 1, price: 2500 },
  ];

  const calculateTotal = () => {
    return mockComandaItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  };

  return (
    <section id="demo" className="py-20 bg-white border-y border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-overline tracking-wider text-[var(--accent)] font-bold">
            EXPERIMENTE NA PRÁTICA
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-1)] tracking-tight">
            Interface intuitiva desenvolvida para velocidade no caixa e na grade
          </h2>
          <p className="text-base text-[var(--text-2)]">
            Sem telas poluídas. Alvos de toque amplos para tablets e atalhos rápidos
            para o operador fechar comandas em segundos.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 bg-[var(--bg-sunken)] rounded-[var(--radius-pill)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveTab("grade")}
              className={`px-5 py-2.5 text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
                activeTab === "grade"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              🎾 Grade de Quadras
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pdv")}
              className={`px-5 py-2.5 text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
                activeTab === "pdv"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              🛒 PDV & Comandas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("crm")}
              className={`px-5 py-2.5 text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
                activeTab === "crm"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              💬 WhatsApp CRM
            </button>
          </div>
        </div>

        {/* Interactive Viewer Area */}
        <div className="bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-modal)] p-4 sm:p-6 shadow-md min-h-[440px]">
          {/* TAB 1: GRADE DE QUADRAS */}
          {activeTab === "grade" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-1)]">
                    Grade de Locação — Hoje (Horário de Pico)
                  </h3>
                  <p className="text-rule">
                    Clique em qualquer slot para simular a reserva ou lançamento direto
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs border border-dashed border-[var(--border-dashed)] bg-white" />
                    Livre
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-[var(--warning)]" />
                    Reservado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-[var(--accent)]" />
                    Em Jogo / Ocupado
                  </span>
                </div>
              </div>

              {/* Grid Layout */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="p-3 text-overline">Horário</th>
                      <th className="p-3 text-overline">Quadra 1 (Padel)</th>
                      <th className="p-3 text-overline">Quadra 2 (Padel)</th>
                      <th className="p-3 text-overline">Quadra 3 (Beach)</th>
                      <th className="p-3 text-overline">Quadra 4 (Beach)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courtSlots.map((slot) => (
                      <tr key={slot.time} className="border-b border-[var(--border-soft)]">
                        <td className="p-3 font-bold text-sm text-[var(--text-1)] whitespace-nowrap">
                          {slot.time}
                        </td>
                        {slot.courts.map((court) => {
                          const isFree = court.status === "free";
                          const isBooked = court.status === "booked";

                          return (
                            <td key={court.name} className="p-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSlotInfo(
                                    `${court.name} - ${slot.time} (${
                                      isFree
                                        ? "Disponível por R$ " + court.price
                                        : court.player
                                    })`
                                  )
                                }
                                className={`w-full p-3 rounded-[var(--radius-card)] text-left transition-all duration-150 border ${
                                  isFree
                                    ? "bg-white border-dashed border-[var(--border-dashed)] hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]"
                                    : isBooked
                                    ? "bg-[var(--warning-bg)] border-[var(--warning-border)] text-[var(--text-1)]"
                                    : "bg-[var(--accent)] border-[var(--accent)] text-white shadow-xs"
                                }`}
                              >
                                <div className="text-xs font-bold truncate">
                                  {isFree ? "Slot Livre" : court.player}
                                </div>
                                <div className="text-[11px] opacity-80 mt-0.5">
                                  {isFree ? `R$ ${court.price},00` : court.status === "booked" ? "Reserva Pendente" : "Em Jogo · Comanda Aberta"}
                                </div>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedSlotInfo && (
                <div className="p-3 bg-[var(--accent-tint)] border border-[var(--border)] rounded-[var(--radius-input)] flex items-center justify-between text-xs font-semibold text-[var(--accent)]">
                  <span>Selecionado: {selectedSlotInfo}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSlotInfo(null)}
                    className="text-xs underline text-[var(--text-2)] hover:text-[var(--text-1)]"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PDV & COMANDAS */}
          {activeTab === "pdv" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
              {/* Left Column: Quick Catalog Items */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <h3 className="text-sm font-bold text-[var(--text-1)]">
                    Catálogo de Lançamento Rápido (PDV Touch)
                  </h3>
                  <span className="text-rule">Preços fixados no lançamento</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Água Mineral 500ml
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 6,00
                    </span>
                    <span className="text-rule block mt-1">+6 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Isotônico Gatorade
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 12,00
                    </span>
                    <span className="text-rule block mt-1">+12 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Cerveja Heineken Longneck
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 14,00
                    </span>
                    <span className="text-rule block mt-1">+14 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Aluguel Raquete Pro
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 25,00
                    </span>
                    <span className="text-rule block mt-1">+25 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Tubo Bola Padel Pro (3un)
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 65,00
                    </span>
                    <span className="text-rule block mt-1">+65 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Overgrip Wilson (1un)
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 18,00
                    </span>
                    <span className="text-rule block mt-1">+18 pontos cashback</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Active Comanda Panel */}
              <div className="bg-white p-4 rounded-[var(--radius-card-touch)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                    <div>
                      <span className="text-overline">Comanda #104</span>
                      <h4 className="text-sm font-bold text-[var(--text-1)]">
                        Quadra 1 — Padel (Lucas Silva)
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[var(--accent-tint)] text-[var(--accent)]">
                      Filiado Ouro
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-[var(--border-soft)] py-2 text-xs">
                    {mockComandaItems.map((item) => (
                      <div key={item.id} className="py-2 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-[var(--text-1)] block">
                            {item.qty}x {item.name}
                          </span>
                          <span className="text-rule">
                            Valor R$ {(item.price / 100).toFixed(2)} un.
                          </span>
                        </div>
                        <span className="font-bold text-[var(--text-1)]">
                          R$ {((item.price * item.qty) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Total */}
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-[var(--text-2)]">Total da Comanda:</span>
                    <span className="text-2xl font-extrabold text-[var(--accent)]">
                      R$ {(calculateTotal() / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2 bg-[var(--success-bg)] border border-[var(--success-border)] rounded-[var(--radius-input)] text-center text-[11px] font-bold text-[var(--success)]">
                    ✓ 207 pontos de cashback serão creditados ao fechar
                  </div>

                  <button
                    type="button"
                    className="w-full py-3 text-sm font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-[var(--radius-button)] shadow-xs transition-colors"
                  >
                    Fechar Comanda & Receber (Pix/Cartão)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP CRM */}
          {activeTab === "crm" && (
            <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-2 border-b border-[var(--border)]">
                <h3 className="text-base font-bold text-[var(--text-1)]">
                  Mensagens Automáticas no WhatsApp
                </h3>
                <p className="text-rule">
                  Sem disparos manuais. Regras automáticas engajam clientes no momento certo.
                </p>
              </div>

              {/* Simulated WhatsApp Chat Cards */}
              <div className="space-y-3">
                {/* Message 1: Lembrete de jogo */}
                <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-2xs space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[var(--accent)]">🎾 Lembrete Automático de Jogo</span>
                    <span className="text-rule">Enviado 2h antes</span>
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    "Olá Gabriel! Seu jogo na <strong>Quadra 1 (Padel)</strong> está agendado para hoje às 19:00. O bar da arena já está aberto com bebidas trincando! Bom jogo!"
                  </p>
                </div>

                {/* Message 2: Aniversário com Voucher */}
                <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-2xs space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[var(--warning)]">🎂 Aniversariante do Dia</span>
                    <span className="text-rule">Disparo 08:00 AM</span>
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    "Parabéns pelo seu dia, Camila! 🎉 A Marcou Arena te presenteia com <strong>1h de quadra grátis</strong> + R$ 20 de cashback no bar para comemorar com os amigos. Resgaste no app!"
                  </p>
                </div>

                {/* Message 3: Reativação de Atleta Inativo */}
                <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-2xs space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[var(--success)]">🔄 Reativação de Atleta (15 dias)</span>
                    <span className="text-rule">Fila Notificação</span>
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    "Sentimos sua falta nas quadras, Rodrigo! Faz 15 dias que você não joga. Agende um horário esta semana e ganhe <strong>pontos em dobro</strong> no seu clube de benefícios!"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
