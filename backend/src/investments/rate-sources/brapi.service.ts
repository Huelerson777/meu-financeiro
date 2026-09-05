import { Injectable, Logger } from '@nestjs/common';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15min — cotação de mercado muda mais rápido que índice do BC

/**
 * Busca cotação de ações e fundos (FII) negociados na B3 via brapi.dev.
 * Precisa de um token gratuito (cadastro em https://brapi.dev) configurado
 * em BRAPI_API_TOKEN — sem ele, degrada graciosamente (loga um aviso e
 * pula a atualização automática, mesmo padrão do MailService quando
 * SMTP_HOST não está configurado).
 */
@Injectable()
export class BrapiService {
  private readonly logger = new Logger(BrapiService.name);
  private readonly token = process.env.BRAPI_API_TOKEN;
  private readonly cache = new Map<string, { fetchedAt: number; price: number }>();

  async getQuote(ticker: string): Promise<number | null> {
    if (!this.token) {
      this.logger.warn(`BRAPI_API_TOKEN não configurado — cotação de "${ticker}" não foi atualizada.`);
      return null;
    }

    const symbol = ticker.trim().toUpperCase();
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.price;

    try {
      const response = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?token=${this.token}`);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = (await response.json()) as { results?: { regularMarketPrice?: number }[] };
      const price = body.results?.[0]?.regularMarketPrice;
      if (typeof price !== 'number') throw new Error('ticker não encontrado');

      this.cache.set(symbol, { fetchedAt: Date.now(), price });
      return price;
    } catch (err) {
      this.logger.warn(`Falha ao buscar cotação de "${symbol}" na brapi.dev: ${(err as Error).message}`);
      return cached?.price ?? null;
    }
  }
}
