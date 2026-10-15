/* eslint-disable @typescript-eslint/no-explicit-any */
// Os tipos gerados do Supabase (integrations/supabase/types.ts) estão defasados em relação às migrações
// (faltam colunas e tabelas novas). Em vez de espalhar `any`, o cast fica só aqui. Regenerar os tipos
// (supabase gen types) deixa este arquivo desnecessário.
export type UntypedDb = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export function untyped(client: unknown): UntypedDb {
  return client as UntypedDb;
}
