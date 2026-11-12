/**
 * O Supabase devolve no máximo 1.000 linhas por consulta, mesmo com .limit(5000). Para somar volumes maiores
 * (leituras, lançamentos, pedidos) busca em páginas de 1.000 até acabar ou chegar em `max`.
 * Use sempre com .order() em coluna estável, senão a paginação pode repetir ou pular linhas.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 20000,
): Promise<{ data: T[]; error: unknown; truncated: boolean }> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: out, error, truncated: false };
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) return { data: out, error: null, truncated: false };
  }
  return { data: out, error: null, truncated: true };
}
