import { Injectable, Logger } from '@nestjs/common';

export interface BacenDataPoint {
  date: Date;
  value: number;
}

export type BacenIndexer = 'CDI' | 'SELIC' | 'IPCA';

const SERIES_CODE: Record<BacenIndexer, number> = { CDI: 12, SELIC: 11, IPCA: 433 };
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — evita bater na API do BC a cada abertura de tela

/**
 * Busca séries históricas do Banco Central (SGS — Sistema Gerenciador de
 * Séries Temporais): CDI e SELIC diários, IPCA mensal. API pública, sem
 * chave/cadastro. Usada por accrual.util.ts pra calcular o rendimento de
 * renda fixa (CDB, Tesouro, LCI/LCA).
 */
@Injectable()
export class BacenService {
  private readonly logger = new Logger(BacenService.name);
  private readonly cache = new Map<string, { fetchedAt: number; data: BacenDataPoint[] }>();

  async getSeries(indexer: BacenIndexer, startDate: Date, endDate: Date): Promise<BacenDataPoint[]> {
    const cacheKey = `${indexer}:${this.formatDate(startDate)}:${this.formatDate(endDate)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

    const code = SERIES_CODE[indexer];
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${this.formatDate(startDate)}&dataFinal=${this.formatDate(endDate)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const raw = (await response.json()) as { data: string; valor: string }[];
      const data = raw.map((item) => ({ date: this.parseDate(item.data), value: Number(item.valor) }));
      this.cache.set(cacheKey, { fetchedAt: Date.now(), data });
      return data;
    } catch (err) {
      // Falha na API do BC não pode derrubar a tela de investimentos — mantém
      // o último valor calculado (cache antigo, se existir) e loga o aviso.
      this.logger.warn(`Falha ao buscar série ${indexer} do Banco Central: ${(err as Error).message}`);
      return cached?.data ?? [];
    }
  }

  private formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
  }

  private parseDate(value: string): Date {
    const [dd, mm, yyyy] = value.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
}
