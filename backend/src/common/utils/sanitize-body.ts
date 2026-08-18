const SENSITIVE_BODY_KEYS = ['password', 'currentPassword', 'newPassword', 'confirmPassword'];

/** Usado antes de gravar qualquer corpo de requisição em log/auditoria. */
export function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object') return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of SENSITIVE_BODY_KEYS) {
    if (key in clone) clone[key] = '[oculto]';
  }
  return clone;
}
