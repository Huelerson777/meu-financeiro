import { sanitizeBody } from './sanitize-body';

describe('sanitizeBody', () => {
  it('oculta senhas, tokens e códigos em qualquer nível', () => {
    const result = sanitizeBody({
      email: 'm@x.com',
      password: '123456',
      refreshToken: 'abc',
      code: '654321',
      nested: { code_verifier: 'xyz', client_id: 'c1' },
    }) as any;

    expect(result.email).toBe('m@x.com');
    expect(result.password).toBe('[oculto]');
    expect(result.refreshToken).toBe('[oculto]');
    expect(result.code).toBe('[oculto]');
    expect(result.nested).toEqual({ code_verifier: '[oculto]', client_id: 'c1' });
  });

  it('corta textos longos (print em base64) em vez de gravar tudo', () => {
    const image = `data:image/png;base64,${'A'.repeat(100_000)}`;
    const result = sanitizeBody({ screen: 'Contas', image }) as any;

    expect(result.screen).toBe('Contas');
    expect(result.image.length).toBeLessThan(600);
    expect(result.image).toContain(`[${image.length} caracteres]`);
  });

  it('guarda só uma amostra de listas grandes (importação em lote)', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ description: `linha ${i}`, amount: i }));
    const result = sanitizeBody({ accountId: 'a1', rows }) as any;

    expect(result.rows).toHaveLength(21);
    expect(result.rows[0]).toEqual({ description: 'linha 0', amount: 0 });
    expect(result.rows[20]).toBe('… [500 itens no total]');
  });

  it('não altera o objeto original nem valores simples', () => {
    const body = { password: 'x', amount: 10, paid: true, notes: null };
    sanitizeBody(body);
    expect(body.password).toBe('x');
    expect(sanitizeBody('texto')).toBe('texto');
    expect(sanitizeBody(undefined)).toBeUndefined();
    expect(sanitizeBody({ amount: 10, paid: true, notes: null })).toEqual({ amount: 10, paid: true, notes: null });
  });
});
