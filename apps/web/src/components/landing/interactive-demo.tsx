"use client";

import React, { useState } from "react";

type DemoTab = "grade" | "pdv" | "ranking" | "crm";

interface CourtSlot {
  time: string;
  courts: {
    name: string;
    type: string;
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
        { name: "Quadra 1", type: "Padel", status: "occupied", player: "Jogo de Ranking (Rodada 4)", price: 120 },
        { name: "Quadra 2", type: "Padel", status: "booked", player: "Ana & Camila", price: 120 },
        { name: "Quadra 3", type: "Beach Tennis", status: "free", price: 90 },
        { name: "Quadra 4", type: "Tênis Saibro", status: "occupied", player: "Desafio de Tênis", price: 110 },
      ],
    },
    {
      time: "19:00",
      courts: [
        { name: "Quadra 1", type: "Padel", status: "booked", player: "Marcos & Gabriel", price: 140 },
        { name: "Quadra 2", type: "Padel", status: "free", price: 140 },
        { name: "Quadra 3", type: "Beach Tennis", status: "occupied", player: "Torneio Open (Quartas)", price: 100 },
        { name: "Quadra 4", type: "Tênis Saibro", status: "booked", player: "Carlos Tênis", price: 110 },
      ],
    },
    {
      time: "20:00",
      courts: [
        { name: "Quadra 1", type: "Padel", status: "occupied", player: "Jogo de Ranking (Rodada 5)", price: 140 },
        { name: "Quadra 2", type: "Padel", status: "occupied", player: "Luciano & Pedro", price: 140 },
        { name: "Quadra 3", type: "Beach Tennis", status: "free", price: 100 },
        { name: "Quadra 4", type: "Tênis Saibro", status: "free", price: 110 },
      ],
    },
  ];

  // Mock items for PDV tab
  const mockComandaItems = [
    { id: 1, name: "Inscrição Torneio Open Duplas", qty: 1, price: 15000 },
    { id: 2, name: "Locação de Quadra (1h Padel)", qty: 1, price: 14000 },
    { id: 3, name: "Água Mineral 500ml", qty: 3, price: 600 },
    { id: 4, name: "Isotônico Gatorade 500ml", qty: 2, price: 1200 },
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
            Gestão completa da grade, torneios e fidelização de atletas
          </h2>
          <p className="text-base text-[var(--text-2)]">
            Descubra como o Marcou Arena aumenta o faturamento do bar, movimenta a grade de jogos e mantêm atletas engajados com o ranking da arena.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 bg-[var(--bg-sunken)] rounded-[var(--radius-pill)] border border-[var(--border)] flex-wrap justify-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("grade")}
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
                activeTab === "grade"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              🎾 Grade de Quadras
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ranking")}
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
                activeTab === "ranking"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]"
              }`}
            >
              🏆 Rankings & Torneios
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pdv")}
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
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
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-[var(--radius-pill)] transition-all ${
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
                      <th className="p-3 text-overline">Quadra 4 (Tênis)</th>
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

          {/* TAB 2: RANKINGS & TORNEIOS */}
          {activeTab === "ranking" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
              {/* Left Column: Rankings do Clube */}
              <div className="bg-white p-5 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div>
                    <span className="text-overline text-[var(--accent)]">FIDELIZAÇÃO DE ATLETAS</span>
                    <h3 className="text-base font-bold text-[var(--text-1)]">
                      Leaderboard — Ranking Oficial do Clube
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]">
                    Categoria A
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-[var(--radius-input)] bg-[var(--accent-tint)] border border-[var(--border-soft)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">
                        1º
                      </span>
                      <div>
                        <span className="font-bold text-[var(--text-1)] block text-sm">Lucas Silva</span>
                        <span className="text-rule">18 Partidas jogadas este mês</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-[var(--accent)] block">1.450 pts</span>
                      <span className="text-[11px] font-bold text-[var(--warning)]">🥇 Filiado Ouro</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-[var(--radius-input)] bg-white border border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-[var(--text-1)] flex items-center justify-center font-bold text-xs">
                        2º
                      </span>
                      <div>
                        <span className="font-bold text-[var(--text-1)] block text-sm">Camila Santos</span>
                        <span className="text-rule">15 Partidas jogadas este mês</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-[var(--text-1)] block">1.280 pts</span>
                      <span className="text-[11px] font-bold text-[var(--warning)]">🥇 Filiada Ouro</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-[var(--radius-input)] bg-white border border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-[var(--text-1)] flex items-center justify-center font-bold text-xs">
                        3º
                      </span>
                      <div>
                        <span className="font-bold text-[var(--text-1)] block text-sm">Gabriel Mendes</span>
                        <span className="text-rule">12 Partidas jogadas este mês</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-[var(--text-1)] block">1.120 pts</span>
                      <span className="text-[11px] font-bold text-slate-600">🥈 Filiado Prata</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-sunken)] rounded-[var(--radius-input)] border border-[var(--border-soft)]">
                  <p className="text-rule text-center">
                    💡 <strong>Como a fidelização funciona:</strong> Atletas pontuam a cada partida agendada na arena, estimulando novos desafios e reservas semanais.
                  </p>
                </div>
              </div>

              {/* Right Column: Torneios e Campeonatos */}
              <div className="bg-white p-5 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs space-y-4">
                <div className="pb-3 border-b border-[var(--border)]">
                  <span className="text-overline text-[var(--accent)]">EVENTOS DA ARENA</span>
                  <h3 className="text-base font-bold text-[var(--text-1)]">
                    Torneios Ativos & Faturamento Extra
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-app)] border border-[var(--border)] space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[var(--accent)] text-white uppercase tracking-wider">
                          EM ANDAMENTO
                        </span>
                        <h4 className="font-bold text-sm text-[var(--text-1)] mt-1">
                          1º Open de Duplas da Arena
                        </h4>
                      </div>
                      <span className="text-xs font-extrabold text-[var(--success)]">
                        +R$ 4.800,00 arrecadados
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-2)]">
                      32 Duplas inscritas · Fases de grupos e eliminatórias geradas automaticamente pelo sistema.
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] font-semibold text-[var(--accent)]">
                      <span>Quadras 1, 2 e 3 reservadas para a etapa</span>
                      <span>Ver Chaves →</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-[var(--radius-card)] bg-white border border-[var(--border)] space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)] uppercase tracking-wider">
                          INSCRIÇÕES ABERTAS
                        </span>
                        <h4 className="font-bold text-sm text-[var(--text-1)] mt-1">
                          Torneio Noturno Misto
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-[var(--text-2)]">
                        Inscrição R$ 75,00/atleta
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-2)]">
                      Inscrições pelo app com cobrança de taxa e consumo integrado no bar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PDV & COMANDAS */}
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
                      Inscrição Torneio Duplas
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 150,00
                    </span>
                    <span className="text-rule block mt-1">+150 pontos cashback</span>
                  </div>

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
                      Cerveja Longneck
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 14,00
                    </span>
                    <span className="text-rule block mt-1">+14 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Aluguel Equipamento
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 25,00
                    </span>
                    <span className="text-rule block mt-1">+25 pontos cashback</span>
                  </div>

                  <div className="bg-white p-3 rounded-[var(--radius-card)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors shadow-2xs">
                    <span className="text-xs font-bold block text-[var(--text-1)]">
                      Tubo de Bolas (3un)
                    </span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      R$ 65,00
                    </span>
                    <span className="text-rule block mt-1">+65 pontos cashback</span>
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
                        Quadra 1 (Lucas Silva)
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
                    ✓ 308 pontos de cashback serão creditados ao fechar
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

          {/* TAB 4: WHATSAPP CRM */}
          {activeTab === "crm" && (
            <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-2 border-b border-[var(--border)]">
                <h3 className="text-base font-bold text-[var(--text-1)]">
                  Mensagens Automáticas no WhatsApp
                </h3>
                <p className="text-rule">
                  Sem disparos manuais. Regras automáticas engajam clientes e convocam atletas para jogos do ranking.
                </p>
              </div>

              {/* Simulated WhatsApp Chat Cards */}
              <div className="space-y-3">
                {/* Message 1: Lembrete de jogo de Ranking */}
                <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-2xs space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[var(--accent)]">🏆 Convocação de Rodada de Ranking</span>
                    <span className="text-rule">Disparo Automático</span>
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    "Olá Lucas! Você tem uma rodada de <strong>Ranking da Categoria A</strong> agendada para hoje às 19:00 contra a dupla Gabriel & Marcos. Confirme sua presença e boa sorte na liderança!"
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
                    <span className="text-rule">Disparo de Fila</span>
                  </div>
                  <p className="text-xs text-[var(--text-2)]">
                    "Sentimos sua falta nas quadras, Rodrigo! Faz 15 dias que você não joga. Agende um horário esta semana e ganhe <strong>pontos em dobro no ranking do clube</strong>!"
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
