import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

// ---------------------------------------------------------------------------
// Porta local — sem importar packages/messaging (evita ciclo de dependência)
// ---------------------------------------------------------------------------

export interface NotificationQueuePort {
  enqueueComandaNotification(input: {
    tenantId: string;
    comandaId: string;
    customerId: string;
    toE164: string;
  }): Promise<void>;
  enqueueTextMessage(input: {
    tenantId: string;
    customerId?: string;
    globalCustomerId?: string;
    comandaId?: string | null;
    toE164: string;
    bodyText: string;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// WPP-02 — Notificação de lançamento na comanda
// ---------------------------------------------------------------------------

type NotificationItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

/** Formata o texto da mensagem de notificação de comanda. Função pura. */
export function buildComandaNotificationText(
  items: NotificationItem[],
  totalCents: number
): string {
  const formatCurrency = (cents: number): string =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const lines = items.map(
    (it) => `• ${it.name} x${it.quantity} — ${formatCurrency(it.unitPriceCents)}`
  );

  return [
    "🧾 *Lançamento na sua comanda:*",
    "",
    ...lines,
    "",
    `*Total parcial: ${formatCurrency(totalCents)}*`,
  ].join("\n");
}

type OptInRow = {
  opt_in: boolean;
  customer_id: string;
};

type CustomerRow = {
  id: string;
  whatsapp: string | null;
};

/**
 * Verifica se a comanda é identificada e o cliente tem opt-in ativo,
 * então enfileira a notificação. Fire-and-forget — nunca lança erro.
 */
export async function enqueueComandaNotificationIfEligible(
  ctx: TenantContext,
  input: { comandaId: string; customerId: string | null },
  queue: NotificationQueuePort
): Promise<void> {
  if (!input.customerId) return;

  assertTenantId(ctx.tenantId);

  const optInResult = await ctx.db.execute<OptInRow>(
    sql`SELECT opt_in, customer_id
        FROM customer_opt_in_lgpd
        WHERE customer_id = ${input.customerId}
          AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const optInRow = rows<OptInRow>(optInResult)[0];
  if (!optInRow?.opt_in) return;

  const customerResult = await ctx.db.execute<CustomerRow>(
    sql`SELECT id, whatsapp
        FROM customers
        WHERE id = ${input.customerId}
          AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const customer = rows<CustomerRow>(customerResult)[0];
  if (!customer?.whatsapp) return;

  await queue.enqueueComandaNotification({
    tenantId: ctx.tenantId,
    comandaId: input.comandaId,
    customerId: input.customerId,
    toE164: customer.whatsapp,
  });
}

// ---------------------------------------------------------------------------
// WPP-03 — Opt-out / Opt-in via palavra-chave recebida no WhatsApp
// ---------------------------------------------------------------------------

const OPT_OUT_KEYWORDS = new Set(["SAIR", "CANCELAR"]);
const OPT_IN_KEYWORDS = new Set(["QUERO", "ATIVAR"]);

const uuidSchema = z.string().uuid();

type CustomerOptInRow = {
  id: string;
  customer_id: string;
};

type CustomerWithWhatsapp = {
  id: string;
  whatsapp: string | null;
};

/**
 * Processa palavra-chave de opt-out ou opt-in recebida via WhatsApp.
 * Retorna o resultado da operação ou 'ignored' quando não reconhecida / remetente desconhecido.
 */
export async function processOptInOutKeyword(
  ctx: TenantContext,
  input: { fromE164: string; text: string },
  queue: NotificationQueuePort
): Promise<"opt_out" | "opt_in" | "ignored"> {
  assertTenantId(ctx.tenantId);

  const keyword = input.text.trim().toUpperCase();
  const isOptOut = OPT_OUT_KEYWORDS.has(keyword);
  const isOptIn = OPT_IN_KEYWORDS.has(keyword);
  if (!isOptOut && !isOptIn) return "ignored";

  const customerResult = await ctx.db.execute<CustomerWithWhatsapp>(
    sql`SELECT id, whatsapp
        FROM customers
        WHERE whatsapp = ${input.fromE164}
          AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const customer = rows<CustomerWithWhatsapp>(customerResult)[0];
  if (!customer) return "ignored";

  const now = new Date();
  const customerId = customer.id;

  const existingResult = await ctx.db.execute<CustomerOptInRow>(
    sql`SELECT id, customer_id
        FROM customer_opt_in_lgpd
        WHERE customer_id = ${customerId}
          AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const existing = rows<CustomerOptInRow>(existingResult)[0];

  if (isOptOut) {
    if (existing) {
      await ctx.db.execute(
        sql`UPDATE customer_opt_in_lgpd
            SET opt_in = false,
                opt_out_at = ${now},
                changed_at = ${now},
                channel = 'whatsapp'
            WHERE customer_id = ${customerId}
              AND tenant_id = ${ctx.tenantId}`
      );
    } else {
      await ctx.db.execute(
        sql`INSERT INTO customer_opt_in_lgpd
              (tenant_id, customer_id, opt_in, opt_out_at, changed_at, channel)
            VALUES (${ctx.tenantId}, ${customerId}, false, ${now}, ${now}, 'whatsapp')`
      );
    }
    await queue.enqueueTextMessage({
      tenantId: ctx.tenantId,
      customerId,
      toE164: input.fromE164,
      bodyText: "Notificações desativadas. Para voltar a receber envie QUERO",
    });
    return "opt_out";
  }

  // isOptIn
  if (existing) {
    await ctx.db.execute(
      sql`UPDATE customer_opt_in_lgpd
          SET opt_in = true,
              opt_in_at = ${now},
              changed_at = ${now},
              channel = 'whatsapp'
          WHERE customer_id = ${customerId}
            AND tenant_id = ${ctx.tenantId}`
    );
  } else {
    await ctx.db.execute(
      sql`INSERT INTO customer_opt_in_lgpd
            (tenant_id, customer_id, opt_in, opt_in_at, changed_at, channel)
          VALUES (${ctx.tenantId}, ${customerId}, true, ${now}, ${now}, 'whatsapp')`
    );
  }
  await queue.enqueueTextMessage({
    tenantId: ctx.tenantId,
    customerId,
    toE164: input.fromE164,
    bodyText: "Notificações reativadas! Você voltará a receber atualizações da sua comanda.",
  });
  return "opt_in";
}

// ---------------------------------------------------------------------------
// WPP-05 — Menu interativo de autoatendimento
// ---------------------------------------------------------------------------

const MENU_KEYWORDS = new Set(["MENU", "AJUDA", "COMANDA"]);

export function isMenuKeyword(text: string): boolean {
  return MENU_KEYWORDS.has(text.trim().toUpperCase());
}

type ComandaItemForMenu = {
  product_name: string;
  quantity: number;
  unit_price: number;
};

type PointsBalanceRow = {
  balance: number;
};

type TenantSlugRow = {
  slug: string;
};

type OpenComandaRow = {
  id: string;
};

/** Monta o texto completo do menu de autoatendimento. */
export async function processMenuRequest(
  ctx: TenantContext,
  input: { fromE164: string; customerId: string; customerName: string }
): Promise<string> {
  assertTenantId(ctx.tenantId);

  if (!uuidSchema.safeParse(input.customerId).success) {
    return "Olá! Para usar o autoatendimento, cadastre-se na arena.";
  }

  const comandaResult = await ctx.db.execute<OpenComandaRow>(
    sql`SELECT id
        FROM comandas
        WHERE tenant_id = ${ctx.tenantId}
          AND customer_id = ${input.customerId}
          AND status = 'open'
        ORDER BY created_at DESC
        LIMIT 1`
  );
  const comanda = rows<OpenComandaRow>(comandaResult)[0];

  let comandaSection: string;
  if (comanda) {
    const itemsResult = await ctx.db.execute<ComandaItemForMenu>(
      sql`SELECT product_name_at_sale AS product_name,
                 quantity,
                 unit_price_cents_at_sale AS unit_price
          FROM comanda_items
          WHERE tenant_id = ${ctx.tenantId}
            AND comanda_id = ${comanda.id}
          ORDER BY created_at`
    );
    const items = rows<ComandaItemForMenu>(itemsResult);
    const totalCents = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
    const formatCurrency = (cents: number): string =>
      `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

    if (items.length === 0) {
      comandaSection = "_Comanda aberta, sem itens lançados._";
    } else {
      const lines = items.map(
        (it) => `  • ${it.product_name} x${it.quantity} — ${formatCurrency(it.unit_price)}`
      );
      comandaSection = [...lines, `  *Total: ${formatCurrency(totalCents)}*`].join("\n");
    }
  } else {
    comandaSection = "_Nenhuma comanda aberta no momento._";
  }

  const pointsResult = await ctx.db.execute<PointsBalanceRow>(
    sql`SELECT balance
        FROM customer_points_balance
        WHERE tenant_id = ${ctx.tenantId}
          AND customer_id = ${input.customerId}
        LIMIT 1`
  );
  const pointsRow = rows<PointsBalanceRow>(pointsResult)[0];
  const pointsSection = pointsRow
    ? `*${pointsRow.balance} pontos* acumulados na arena.`
    : "_Você não possui pontos cadastrados._";

  const slugResult = await ctx.db.execute<TenantSlugRow>(
    sql`SELECT slug FROM tenants WHERE id = ${ctx.tenantId} LIMIT 1`
  );
  const slug = rows<TenantSlugRow>(slugResult)[0]?.slug ?? "";

  const athleteUrl = `https://${slug}.marcouarena.com.br/atleta`;
  const bookingUrl = `https://${slug}.marcouarena.com.br/reservas`;

  return [
    `Olá, *${input.customerName}*! 👋`,
    "",
    "📄 *1. Sua comanda:*",
    comandaSection,
    "",
    "🪙 *2. Seus pontos:*",
    pointsSection,
    "",
    "✏️ *3. Atualizar dados:*",
    athleteUrl,
    "",
    "🎾 *4. Reservar quadra:*",
    bookingUrl,
  ].join("\n");
}
