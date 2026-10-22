import * as crypto from 'crypto';

/**
 * Valida o header X-Twilio-Signature: base64(HMAC-SHA1(authToken, url +
 * parâmetros do POST ordenados por nome, cada um como nome+valor)). A `url`
 * precisa ser exatamente a configurada no console da Twilio.
 */
export function isValidTwilioSignature(
  authToken: string | undefined,
  url: string | undefined,
  params: Record<string, unknown> | undefined,
  signatureHeader: string | undefined,
): boolean {
  if (!authToken || !url || !signatureHeader) return false;

  const data = Object.keys(params ?? {})
    .sort()
    .reduce((acc, key) => acc + key + String((params as Record<string, unknown>)[key] ?? ''), url);

  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/** "whatsapp:+5547999999999" -> "5547999999999" */
export function digitsOnly(address: string): string {
  return address.replace(/\D/g, '');
}

/**
 * A Meta/Twilio às vezes entregam celulares brasileiros sem o 9º dígito
 * (55 + DDD + 8 dígitos) mesmo quando o usuário cadastrou com ele (55 + DDD
 * + 9 + 8 dígitos), ou o contrário. Devolve as duas formas pra busca.
 */
export function phoneVariants(raw: string): string[] {
  const digits = digitsOnly(raw);
  const variants = new Set([digits]);

  if (digits.startsWith('55')) {
    if (digits.length === 12) {
      variants.add(`${digits.slice(0, 4)}9${digits.slice(4)}`);
    } else if (digits.length === 13 && digits[4] === '9') {
      variants.add(`${digits.slice(0, 4)}${digits.slice(5)}`);
    }
  }

  return [...variants];
}
