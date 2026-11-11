import { Transform } from 'class-transformer';

/** E-mail sempre em minúsculas e sem espaços nas pontas — "Maria@X.com" e "maria@x.com" são a mesma conta. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Decorator de DTO: normaliza o e-mail antes da validação (exige ValidationPipe com transform: true). */
export function NormalizeEmail() {
  return Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value));
}
