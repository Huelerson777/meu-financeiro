/** Escapa texto vindo do usuário antes de colocá-lo no HTML de um e-mail. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
