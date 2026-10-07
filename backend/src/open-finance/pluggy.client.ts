import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const API = 'https://api.pluggy.ai';
const KEY_TTL_MS = 100 * 60 * 1000; // a apiKey da Pluggy vale 2h
const PAGE_SIZE = 500;

export interface PluggyAccount {
  id: string;
  type: 'BANK' | 'CREDIT';
  subtype?: string;
  name: string;
  number?: string;
  balance: number;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  status?: 'PENDING' | 'POSTED';
}

/**
 * Cliente mínimo da API da Pluggy (Meu Pluggy). As credenciais ficam só no servidor
 * (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET); sem elas, as chamadas falham com 503.
 */
@Injectable()
export class PluggyClient {
  private readonly logger = new Logger(PluggyClient.name);
  private apiKey: { value: string; fetchedAt: number } | null = null;

  private async getApiKey(): Promise<string> {
    if (this.apiKey && Date.now() - this.apiKey.fetchedAt < KEY_TTL_MS) return this.apiKey.value;

    const clientId = process.env.PLUGGY_CLIENT_ID;
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Open Finance não configurado (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET)');
    }

    const response = await fetch(`${API}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!response.ok) {
      this.logger.error(`Falha ao autenticar na Pluggy: status ${response.status}`);
      throw new ServiceUnavailableException('Não foi possível autenticar na Pluggy');
    }
    const { apiKey } = (await response.json()) as { apiKey: string };
    this.apiKey = { value: apiKey, fetchedAt: Date.now() };
    return apiKey;
  }

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const response = await fetch(`${API}${path}?${query}`, { headers: { 'X-API-KEY': await this.getApiKey() } });
    if (!response.ok) {
      this.logger.warn(`Pluggy GET ${path} falhou: status ${response.status}`);
      throw new ServiceUnavailableException(`A Pluggy respondeu com erro (${response.status})`);
    }
    return (await response.json()) as T;
  }

  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    const body = await this.get<{ results: PluggyAccount[] }>('/accounts', { itemId });
    return body.results;
  }

  async listTransactions(accountId: string, from: Date): Promise<PluggyTransaction[]> {
    const all: PluggyTransaction[] = [];
    for (let page = 1; ; page++) {
      const body = await this.get<{ results: PluggyTransaction[]; totalPages: number }>('/transactions', {
        accountId,
        from: from.toISOString().slice(0, 10),
        pageSize: PAGE_SIZE,
        page,
      });
      all.push(...body.results);
      if (page >= body.totalPages) return all;
    }
  }
}
