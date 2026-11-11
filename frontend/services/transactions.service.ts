import { api } from './api';

const PAGE_SIZE = 100; // máximo aceito pela API por página
const MAX_PAGES = 20; // trava de segurança: 2.000 lançamentos num único filtro

/**
 * Busca TODAS as transações do filtro, página por página.
 *
 * A listagem devolve no máximo 100 por chamada. Telas que calculam algo em
 * cima do mês inteiro (maiores gastos, detalhe de receitas/despesas) pediam só
 * a primeira página: com mais de 100 lançamentos no período, o resultado saía
 * incompleto sem nenhum aviso.
 */
export async function fetchAllTransactions<T = any>(
  params: Record<string, string | number | undefined>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await api.get('/transactions', { params: { ...params, limit: PAGE_SIZE, page } });
    const body = res.data?.data ?? res.data;
    const items: T[] = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
    all.push(...items);

    const totalPages = Number(body?.meta?.totalPages ?? 1);
    if (items.length === 0 || page >= totalPages) break;
  }
  return all;
}
