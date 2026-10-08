/** Corpo do e-mail com o código de verificação de cadastro. */
export function verificationEmailHtml(name: string, code: string, expiresMinutes: number) {
  return (
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">` +
    `<p>Olá, ${escapeHtml(name)}.</p>` +
    `<p>Use o código abaixo para confirmar seu e-mail no PouPay:</p>` +
    `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>` +
    `<p>Ele expira em ${expiresMinutes} minutos.</p>` +
    `<p style="color:#6b7280;font-size:13px">Se você não criou uma conta no PouPay, pode ignorar este e-mail.</p>` +
    `</div>`
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
