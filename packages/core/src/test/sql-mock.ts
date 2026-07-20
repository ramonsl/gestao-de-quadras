/**
 * Utilitários de teste para os serviços que usam `db.execute(sql\`...\`)`.
 *
 * Os serviços de SAAS-12 (user.service / auth.service) não usam o query builder
 * do Drizzle: montam SQL parametrizado com o template `sql\`...\`` e chamam
 * `db.execute()`, esperando `{ rows: [...] }`. Estes helpers permitem:
 *   - extrair o texto estático da query (`sqlText`) para roteamento/asserção;
 *   - extrair os parâmetros interpolados (`sqlParams`) para provar que dados
 *     sensíveis (senha/hash) nunca vazam para os logs de auditoria;
 *   - construir um fake de `db` que responde por intenção da query e registra
 *     cada chamada em `calls` (factory — nunca compartilha estado entre testes).
 */

// ---------------------------------------------------------------------------
// Extração do SQL parametrizado do Drizzle
// ---------------------------------------------------------------------------

/** Concatena o texto estático (keywords + identificadores) de um SQL do Drizzle. */
export function sqlText(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (Array.isArray(node)) return node.map(sqlText).join("");
  const anyNode = node as { constructor?: { name?: string }; value?: unknown; queryChunks?: unknown[] };
  const name = anyNode.constructor?.name;
  if (name === "StringChunk") {
    return Array.isArray(anyNode.value) ? (anyNode.value as string[]).join("") : String(anyNode.value ?? "");
  }
  if (name === "Name") {
    return String(anyNode.value ?? "");
  }
  if (Array.isArray(anyNode.queryChunks)) {
    return anyNode.queryChunks.map(sqlText).join("");
  }
  return "";
}

/** Coleta os valores dos parâmetros interpolados (`${...}`) de um SQL do Drizzle. */
export function sqlParams(node: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (n: unknown): void => {
    if (n === null || n === undefined) return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const anyNode = n as { constructor?: { name?: string }; queryChunks?: unknown[]; valueOf?: () => unknown };
    const name = anyNode.constructor?.name;
    if (name === "StringChunk" || name === "Name") return;
    if (Array.isArray(anyNode.queryChunks)) {
      anyNode.queryChunks.forEach(walk);
      return;
    }
    try {
      out.push(anyNode.valueOf ? anyNode.valueOf() : String(n));
    } catch {
      out.push(String(n));
    }
  };
  walk(node);
  return out;
}

// ---------------------------------------------------------------------------
// Fake de `db.execute` roteado por intenção da query
// ---------------------------------------------------------------------------

export interface RecordedCall {
  text: string;
  params: unknown[];
}

export interface MockDbScenario {
  /** Uma linha de usuário retornada por fetchUser/getArenaUser (SELECT ... WHERE id). */
  user?: Record<string, unknown> | null;
  /** Linhas retornadas pela listagem (SELECT ... ORDER BY name). */
  list?: Record<string, unknown>[];
  /** true → SELECT de unicidade de username encontra registro. */
  usernameTaken?: boolean;
  /** true → SELECT de unicidade de email encontra registro. */
  emailTaken?: boolean;
  /** Quantidade de OUTROS admins ativos (resultado do COUNT(*) com exclusão do alvo). */
  otherActiveAdmins?: number;
  /** id retornado pelo INSERT ... RETURNING id (criação). */
  newUserId?: string;
}

export interface MockDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  calls: RecordedCall[];
  /** Todas as queries de INSERT em audit_logs emitidas. */
  auditInserts(): RecordedCall[];
  /** A query de auditoria cuja lista de params contém a `action` informada. */
  auditFor(action: string): RecordedCall | undefined;
}

/**
 * Cria um fake de `db` para os serviços SAAS-12. Roteia `execute()` conforme a
 * intenção da query e registra cada chamada. Cada teste chama a factory (dados
 * de teste nunca dependem de estado de outro teste).
 */
export function createMockDb(scenario: MockDbScenario = {}): MockDb {
  const calls: RecordedCall[] = [];

  const execute = async (sqlObj: unknown): Promise<{ rows: unknown[] }> => {
    const text = sqlText(sqlObj);
    const params = sqlParams(sqlObj);
    calls.push({ text, params });

    const isSelect = /^\s*SELECT/i.test(text);
    const isFetchUser = isSelect && /must_change_password/.test(text) && /WHERE id =/.test(text);
    const isList = isSelect && /ORDER BY name/.test(text);
    const isUsernameCheck = isSelect && /WHERE username =/.test(text) && !isFetchUser;
    const isEmailCheck = isSelect && /WHERE email =/.test(text) && !isFetchUser;
    const isCount = isSelect && /COUNT\(\*\)/.test(text);
    const isUserInsert = /INSERT INTO/i.test(text) && /users_tenants/.test(text);

    if (isFetchUser) return { rows: scenario.user ? [scenario.user] : [] };
    if (isList) return { rows: scenario.list ?? [] };
    if (isUsernameCheck) return { rows: scenario.usernameTaken ? [{ id: "existing-username" }] : [] };
    if (isEmailCheck) return { rows: scenario.emailTaken ? [{ id: "existing-email" }] : [] };
    if (isCount) return { rows: [{ count: scenario.otherActiveAdmins ?? 0 }] };
    if (isUserInsert) return { rows: [{ id: scenario.newUserId ?? "new-user-id" }] };

    // audit inserts / updates: nada a retornar
    return { rows: [] };
  };

  return {
    db: { execute },
    calls,
    auditInserts: () => calls.filter((c) => /INSERT INTO/i.test(c.text) && /audit_logs/.test(c.text)),
    auditFor: (action: string) =>
      calls.find(
        (c) => /INSERT INTO/i.test(c.text) && /audit_logs/.test(c.text) && c.params.some((p) => p === action)
      ),
  };
}
