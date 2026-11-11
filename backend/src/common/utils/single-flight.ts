/**
 * Garante uma execução por chave de cada vez: quem chamar enquanto já existe
 * uma em andamento para a mesma chave recebe a mesma Promise, em vez de
 * disparar outra em paralelo.
 *
 * Usado nas rotinas "confere se já existe e, se não, cria" (sync de contas
 * fixas, de assinaturas do cartão, de notificações), que o frontend chama ao
 * abrir várias telas: duas execuções simultâneas passam as duas pela
 * conferência antes de qualquer uma gravar e o registro sai duplicado.
 *
 * A trava é por processo — cobre o caso real (uma instância só). Com mais de
 * uma instância, o reforço certo é um índice único no banco.
 */
export class KeyedSingleFlight<T> {
  private readonly inFlight = new Map<string, Promise<T>>();

  run(key: string, task: () => Promise<T>): Promise<T> {
    const running = this.inFlight.get(key);
    if (running) return running;

    const promise = task().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }
}
