// Chaves que nunca podem ir pro log/auditoria: senhas, tokens de sessão,
// códigos de verificação e segredos do fluxo OAuth do MCP.
const SENSITIVE_BODY_KEYS = new Set(
  [
    'password',
    'currentPassword',
    'newPassword',
    'confirmPassword',
    'token',
    'refreshToken',
    'refresh_token',
    'accessToken',
    'access_token',
    'code',
    'code_verifier',
    'codeVerifier',
    'client_secret',
  ].map((k) => k.toLowerCase()),
);

// Um print de tela em base64 (feedback) ou logo de conta tem dezenas de KB a
// alguns MB — gravar isso inteiro em cada linha de auditoria incha a tabela
// `logs` sem servir pra nada. Guarda só o começo, o bastante pra identificar.
const MAX_STRING_LENGTH = 500;
// Importações em lote mandam centenas de linhas; o log guarda uma amostra.
const MAX_ARRAY_ITEMS = 20;
const MAX_DEPTH = 5;

/** Usado antes de gravar qualquer corpo de requisição em log/auditoria. */
export function sanitizeBody(body: unknown): unknown {
  return sanitize(body, 0);
}

function sanitize(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}… [${value.length} caracteres]`
      : value;
  }
  if (!value || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[omitido]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`… [${value.length} itens no total]`);
    return items;
  }

  const clone: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = SENSITIVE_BODY_KEYS.has(key.toLowerCase()) ? '[oculto]' : sanitize(inner, depth + 1);
  }
  return clone;
}
