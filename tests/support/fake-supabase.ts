/**
 * Um "Supabase de mentira" para testar as Server Actions sem banco:
 * registra cada chamada (tabela, operação, dados e filtros) e devolve
 * a resposta configurada para aquela tabela + operação.
 */

type Operation = "select" | "insert" | "upsert" | "update" | "delete";

export type RecordedCall = {
  table: string;
  operation: Operation;
  payload?: unknown;
  filters: [string, unknown][];
};

type Response = { data: unknown; error: unknown };

export function createFakeSupabase(responses: Partial<Record<`${string}.${Operation}`, Response | Response[]>> = {}) {
  const calls: RecordedCall[] = [];
  const counters = new Map<string, number>();

  function nextResponse(key: string): Response {
    const configured = responses[key as keyof typeof responses];
    if (!configured) return { data: null, error: null };
    if (!Array.isArray(configured)) return configured;
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);
    return configured[Math.min(index, configured.length - 1)];
  }

  function from(table: string) {
    const call: RecordedCall = { table, operation: "select", filters: [] };
    let started = false;

    const builder = {
      select() {
        if (!started) {
          started = true;
          calls.push(call);
        }
        return builder;
      },
      insert(payload: unknown) {
        Object.assign(call, { operation: "insert", payload });
        started = true;
        calls.push(call);
        return builder;
      },
      upsert(payload: unknown) {
        Object.assign(call, { operation: "upsert", payload });
        started = true;
        calls.push(call);
        return builder;
      },
      update(payload: unknown) {
        Object.assign(call, { operation: "update", payload });
        started = true;
        calls.push(call);
        return builder;
      },
      delete() {
        call.operation = "delete";
        started = true;
        calls.push(call);
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      gte(column: string, value: unknown) {
        call.filters.push([`${column}>=`, value]);
        return builder;
      },
      in(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      neq(column: string, value: unknown) {
        call.filters.push([`${column} !=`, value]);
        return builder;
      },
      not(column: string, operator: string, value: unknown) {
        call.filters.push([`${column} not ${operator}`, value]);
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      single: () => Promise.resolve(nextResponse(`${table}.${call.operation}`)),
      maybeSingle: () => Promise.resolve(nextResponse(`${table}.${call.operation}`)),
      then(resolve: (value: Response) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(nextResponse(`${table}.${call.operation}`)).then(resolve, reject);
      },
    };
    return builder;
  }

  return { client: { from }, calls };
}
