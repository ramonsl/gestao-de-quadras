import { hash } from "@node-rs/argon2";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  tenants,
  globalCustomers,
  customers,
  products,
  courts,
  courtServices,
  courtTimeSlots,
  classPackages,
  pointsSettings,
  customerPointsBalance,
  customerPointsTransactions,
  cashSessions,
  comandas,
  comandaItems,
} from "./schema";
import { getDatabaseUrl } from "./env";

const MODULES = JSON.stringify([
  "pdv",
  "cadastros",
  "quadras",
  "aulas",
  "financeiro",
  "relatorios",
  "publicidade",
  "pontos",
]);

export async function runSeed() {
  console.log("🌱 Iniciando o seed do banco de dados...");
  console.log(`Target database: ${getDatabaseUrl().split("@")[1]?.split("/")[0] ?? "Local"}`);

  // 1. Criar ou buscar Tenant Demo
  let [tenant] = await db
    .select()
    .from(tenants)
    .where(sql`slug = 'arena-demo'`)
    .limit(1);

  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({
        slug: "arena-demo",
        name: "Arena Marcou Padel & Beach",
        status: "active",
      })
      .returning();
    console.log(`✅ Tenant criado: ${tenant.name} (${tenant.id})`);
  } else {
    console.log(`ℹ️ Tenant existente reutilizado: ${tenant.name}`);
  }

  const tenantId = tenant.id;
  const passwordHash = await hash("admin123");

  // 2. Operadores da Arena (Admin, Gerente, Atendente)
  const usersData = [
    { username: "admin", name: "Administrador Geral", email: "admin@arena.com", role: "admin" },
    { username: "gerente", name: "Carlos Gerente", email: "carlos@arena.com", role: "gerente" },
    { username: "atendente", name: "Ana Atendente", email: "ana@arena.com", role: "atendente" },
  ];

  let adminUserId = "";
  for (const u of usersData) {
    const res = await db.execute<{ id: string }>(
      sql`INSERT INTO users_tenants (tenant_id, username, name, email, password_hash, role, modules_allowed, status, activated_at)
          VALUES (${tenantId}, ${u.username}, ${u.name}, ${u.email}, ${passwordHash}, ${u.role}, ${MODULES}, 'active', now())
          ON CONFLICT (tenant_id, username) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
          RETURNING id`
    );
    if (u.username === "admin") {
      adminUserId = res.rows[0].id as string;
    }
  }
  console.log("✅ Operadores cadastrados (admin, gerente, atendente - senha: admin123)");

  // 3. Clientes Globais e Clientes da Arena
  const mockCustomers = [
    { name: "Maria Oliveira", whatsapp: "51999992222", email: "maria@gmail.com", points: 800 },
    { name: "João Silva", whatsapp: "51999991111", email: "joao@gmail.com", points: 1500 },
    { name: "Pedro Santos", whatsapp: "51999993333", email: "pedro@gmail.com", points: 250 },
    { name: "Ana Paula Costa", whatsapp: "51999994444", email: "anapaula@gmail.com", points: 0 },
    { name: "Lucas Ferreira", whatsapp: "51999995555", email: "lucas@gmail.com", points: 600 },
  ];

  const createdCustomers: Array<{ id: string; name: string; points: number }> = [];

  for (const c of mockCustomers) {
    const [globalCust] = await db
      .insert(globalCustomers)
      .values({
        whatsapp: c.whatsapp,
        name: c.name,
        email: c.email,
      })
      .onConflictDoUpdate({
        target: globalCustomers.whatsapp,
        set: { name: c.name, email: c.email },
      })
      .returning();

    const [arenaCust] = await db
      .insert(customers)
      .values({
        tenantId,
        globalCustomerId: globalCust.id,
        whatsapp: c.whatsapp,
        name: c.name,
        email: c.email,
        createdByUserId: adminUserId,
      })
      .onConflictDoUpdate({
        target: [customers.tenantId, customers.whatsapp],
        set: { name: c.name, email: c.email },
      })
      .returning();

    createdCustomers.push({ id: arenaCust.id, name: c.name, points: c.points });
  }
  console.log(`✅ ${createdCustomers.length} Clientes cadastrados com números de WhatsApp fictícios.`);

  // 4. Produtos do Bar e Loja
  const mockProducts = [
    { name: "Cerveja Heineken Long Neck 330ml", category: "Bebidas Alcoólicas", price: 1200, stock: 48, barcode: "78919100001" },
    { name: "Água Mineral 500ml Sem Gás", category: "Bebidas Não Alcoólicas", price: 500, stock: 120, barcode: "78919100002" },
    { name: "Coca-Cola 350ml Lata", category: "Bebidas Não Alcoólicas", price: 700, stock: 60, barcode: "78919100003" },
    { name: "Energético Red Bull 250ml", category: "Bebidas Não Alcoólicas", price: 1600, stock: 30, barcode: "78919100004" },
    { name: "Gatorade 500ml Limão", category: "Isotônicos", price: 900, stock: 40, barcode: "78919100005" },
    { name: "Overgrip Wilson Pro Comfort (1 un)", category: "Acessórios", price: 1800, stock: 25, barcode: "78919100006" },
    { name: "Tubo Bolinhas de Padel Head Pro (3 un)", category: "Bolas & Equipamentos", price: 6500, stock: 15, barcode: "78919100007" },
    { name: "Porção de Batata Frita 400g", category: "Petiscos & Lanches", price: 3200, stock: 50, barcode: "78919100008" },
  ];

  const createdProducts = [];
  for (const p of mockProducts) {
    const existing = await db
      .select()
      .from(products)
      .where(sql`tenant_id = ${tenantId} AND name = ${p.name}`)
      .limit(1);

    if (existing.length > 0) {
      createdProducts.push(existing[0]);
    } else {
      const [inserted] = await db
        .insert(products)
        .values({
          tenantId,
          name: p.name,
          category: p.category,
          salePriceCents: p.price,
          currentStock: p.stock,
          minStock: 5,
          barcode: p.barcode,
        })
        .returning();
      createdProducts.push(inserted);
    }
  }
  console.log(`✅ ${createdProducts.length} Produtos cadastrados no estoque do Bar/Loja.`);

  // 5. Quadras & Serviços
  const mockCourts = [
    { name: "Quadra 01 - Panorâmica Principal", modality: "Padel" },
    { name: "Quadra 02 - Coberta Pro", modality: "Padel" },
    { name: "Quadra 03 - Beach Tennis Sunset", modality: "Beach Tennis" },
    { name: "Quadra 04 - Beach Tennis Central", modality: "Beach Tennis" },
  ];

  const createdCourts = [];
  for (const c of mockCourts) {
    const existing = await db
      .select()
      .from(courts)
      .where(sql`tenant_id = ${tenantId} AND name = ${c.name}`)
      .limit(1);

    let court;
    if (existing.length > 0) {
      court = existing[0];
    } else {
      [court] = await db
        .insert(courts)
        .values({
          tenantId,
          name: c.name,
          modality: c.modality,
          isActive: true,
        })
        .returning();

      // Adiciona serviço de locação por padrão
      await db.insert(courtServices).values({
        tenantId,
        courtId: court.id,
        serviceType: "rental",
        basePriceInCents: c.modality === "Padel" ? 14000 : 10000,
      });
    }
    createdCourts.push(court);
  }
  console.log(`✅ ${createdCourts.length} Quadras e serviços de locação cadastrados.`);

  // 6. Faixas Horárias (Time Slots)
  const weekdays = [1, 2, 3, 4, 5]; // Seg a Sex
  for (const day of weekdays) {
    const existingSlot = await db
      .select()
      .from(courtTimeSlots)
      .where(
        sql`tenant_id = ${tenantId} AND court_id = ${createdCourts[0].id} AND day_of_week = ${day} AND start_time_hhmm = '18:00'`
      )
      .limit(1);

    if (existingSlot.length === 0) {
      await db.insert(courtTimeSlots).values({
        tenantId,
        courtId: createdCourts[0].id,
        dayOfWeek: day,
        startTimeHHMM: "18:00",
        endTimeHHMM: "19:30",
        durationMinutes: 90,
        priceInCents: 14000,
      });
      await db.insert(courtTimeSlots).values({
        tenantId,
        courtId: createdCourts[0].id,
        dayOfWeek: day,
        startTimeHHMM: "19:30",
        endTimeHHMM: "21:00",
        durationMinutes: 90,
        priceInCents: 14000,
      });
    }
  }
  console.log("✅ Faixas horárias noturnas cadastradas para a Quadra 01.");

  // 7. Pacotes de Aulas
  const mockPackages = [
    { name: "Pacote Padel Iniciante (4 Aulas)", count: 4, price: 32000 },
    { name: "Pacote Padel Intensivo (8 Aulas)", count: 8, price: 60000 },
    { name: "Pacote Beach Tennis (4 Aulas)", count: 4, price: 28000 },
  ];
  for (const pkg of mockPackages) {
    const existingPkg = await db
      .select()
      .from(classPackages)
      .where(sql`tenant_id = ${tenantId} AND name = ${pkg.name}`)
      .limit(1);

    if (existingPkg.length === 0) {
      await db.insert(classPackages).values({
        tenantId,
        name: pkg.name,
        totalClassCount: pkg.count,
        priceInCents: pkg.price,
        isActive: true,
      });
    }
  }
  console.log("✅ Pacotes de Aulas cadastrados.");

  // 8. Programa de Pontos / Cashback (Configuração e Saldos)
  await db
    .insert(pointsSettings)
    .values({
      tenantId,
      enabled: true,
      earnRateCentsPerPoint: 100,
      redemptionPointsPerReal: 100,
      maxRedemptionPercentage: 50,
      allowedParticipants: "all",
      expirationDays: 180,
    })
    .onConflictDoUpdate({
      target: pointsSettings.tenantId,
      set: { enabled: true },
    });

  for (const c of createdCustomers) {
    if (c.points > 0) {
      await db
        .insert(customerPointsBalance)
        .values({
          tenantId,
          customerId: c.id,
          balance: c.points,
        })
        .onConflictDoUpdate({
          target: [customerPointsBalance.tenantId, customerPointsBalance.customerId],
          set: { balance: c.points },
        });

      await db.insert(customerPointsTransactions).values({
        tenantId,
        customerId: c.id,
        amountPoints: c.points,
        transactionType: "earn",
        description: "Bônus inicial do programa de cashback",
        operatorUserId: adminUserId,
      });
    }
  }
  console.log("✅ Programa de Pontos ativado e saldos iniciais concedidos a clientes.");

  // 9. Sessão de Caixa Aberta (se não houver uma aberta)
  let [cashSession] = await db
    .select()
    .from(cashSessions)
    .where(sql`tenant_id = ${tenantId} AND status = 'open'`)
    .limit(1);

  if (!cashSession) {
    [cashSession] = await db
      .insert(cashSessions)
      .values({
        tenantId,
        openedByUserId: adminUserId,
        openingFloatCents: 20000, // R$ 200,00 de troco inicial
        status: "open",
        openedAt: new Date(),
      })
      .returning();
    console.log(`✅ Caixa aberto no PDV com saldo inicial de R$ 200,00 (Sessão ID: ${cashSession.id}).`);
  } else {
    console.log(`ℹ️ Sessão de caixa aberta já existente (ID: ${cashSession.id}).`);
  }

  // 10. Comandas de Teste (Abertas)
  const openComandas = await db
    .select()
    .from(comandas)
    .where(sql`tenant_id = ${tenantId} AND status = 'open'`);

  // Garantir que haja comandas abertas de teste com itens
  const [comanda1] = await db
    .insert(comandas)
    .values({
      tenantId,
      customerId: createdCustomers[0].id,
      status: "open",
      openedByUserId: adminUserId,
    })
    .returning();

    await db.insert(comandaItems).values([
      {
        tenantId,
        comandaId: comanda1.id,
        productId: createdProducts[0].id,
        productNameAtSale: createdProducts[0].name,
        quantity: 2,
        unitPriceCentsAtSale: createdProducts[0].salePriceCents,
        operatorUserId: adminUserId,
      },
      {
        tenantId,
        comandaId: comanda1.id,
        productId: createdProducts[7].id,
        productNameAtSale: createdProducts[7].name,
        quantity: 1,
        unitPriceCentsAtSale: createdProducts[7].salePriceCents,
        operatorUserId: adminUserId,
      },
    ]);

    // Comanda #2: Venda Balcão (Anônima)
    const [comanda2] = await db
      .insert(comandas)
      .values({
        tenantId,
        customerId: null,
        status: "open",
        openedByUserId: adminUserId,
      })
      .returning();

    await db.insert(comandaItems).values([
      {
        tenantId,
        comandaId: comanda2.id,
        productId: createdProducts[1].id,
        productNameAtSale: createdProducts[1].name,
        quantity: 1,
        unitPriceCentsAtSale: createdProducts[1].salePriceCents,
        operatorUserId: adminUserId,
      },
      {
        tenantId,
        comandaId: comanda2.id,
        productId: createdProducts[4].id,
        productNameAtSale: createdProducts[4].name,
        quantity: 1,
        unitPriceCentsAtSale: createdProducts[4].salePriceCents,
        operatorUserId: adminUserId,
      },
    ]);

    console.log("✅ 2 Comandas abertas de teste com produtos lançados no PDV.");

  console.log("\n🚀 Banco semeado com sucesso! Tudo pronto para testes.");
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Erro ao popular o banco:", err);
      process.exit(1);
    });
}
