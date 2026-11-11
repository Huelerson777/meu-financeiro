/**
 * Contador de tentativas em memória, por chave (ex: e-mail), com janela fixa.
 *
 * Complementa o ThrottlerGuard global, que conta por IP: atrás do proxy da
 * Vercel/Render vários usuários compartilham o mesmo IP e um atacante troca
 * de IP à vontade, então o limite por IP sozinho não protege uma conta
 * específica de força bruta. Aqui a chave é a própria conta.
 *
 * É por processo (reinicia com o servidor) — suficiente pra uma instância só.
 */
export class AttemptLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string, now: number = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.entries.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  registerFailure(key: string, now: number = Date.now()) {
    const entry = this.entries.get(key);
    if (entry && entry.resetAt > now) {
      entry.count++;
      return;
    }
    if (this.entries.size > 5_000) this.prune(now);
    this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
  }

  reset(key: string) {
    this.entries.delete(key);
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}
