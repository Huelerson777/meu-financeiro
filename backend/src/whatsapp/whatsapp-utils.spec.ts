import * as crypto from 'crypto';
import { buildTwiml, digitsOnly, isValidCronSecret, isValidTwilioSignature, phoneVariants } from './whatsapp-utils';

describe('isValidTwilioSignature', () => {
  const token = 'auth-token-de-teste';
  const url = 'https://exemplo.onrender.com/api/whatsapp/twilio';
  const params = { From: 'whatsapp:+5547999999999', Body: 'gastei 20', NumMedia: '0' };

  const sign = (p: Record<string, string>) => {
    const data = Object.keys(p)
      .sort()
      .reduce((acc, k) => acc + k + p[k], url);
    return crypto.createHmac('sha1', token).update(data).digest('base64');
  };

  it('aceita assinatura correta', () => {
    expect(isValidTwilioSignature(token, url, params, sign(params))).toBe(true);
  });

  it('rejeita corpo alterado', () => {
    expect(isValidTwilioSignature(token, url, { ...params, Body: 'gastei 2000' }, sign(params))).toBe(false);
  });

  it('rejeita URL diferente', () => {
    expect(isValidTwilioSignature(token, `${url}/x`, params, sign(params))).toBe(false);
  });

  it('rejeita quando falta token, url ou header', () => {
    expect(isValidTwilioSignature(undefined, url, params, sign(params))).toBe(false);
    expect(isValidTwilioSignature(token, undefined, params, sign(params))).toBe(false);
    expect(isValidTwilioSignature(token, url, params, undefined)).toBe(false);
  });
});

describe('isValidCronSecret', () => {
  it('aceita só o segredo exato', () => {
    expect(isValidCronSecret('s3gredo', 's3gredo')).toBe(true);
    expect(isValidCronSecret('s3gredo', 's3gredO')).toBe(false);
    expect(isValidCronSecret('s3gredo', 's3gredo-mais-longo')).toBe(false);
  });

  it('nega sempre quando o segredo não está configurado ou não foi enviado', () => {
    expect(isValidCronSecret(undefined, 'qualquer')).toBe(false);
    expect(isValidCronSecret('', '')).toBe(false);
    expect(isValidCronSecret('s3gredo', undefined)).toBe(false);
  });
});

describe('buildTwiml', () => {
  it('uma Message por resposta, com XML escapado', () => {
    expect(buildTwiml(['Lançado: R$ 20 & "mercado" <ok>', 'segunda'])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response>' +
        '<Message>Lançado: R$ 20 &amp; &quot;mercado&quot; &lt;ok&gt;</Message>' +
        '<Message>segunda</Message></Response>',
    );
  });

  it('sem respostas devolve Response vazio', () => {
    expect(buildTwiml([])).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });
});

describe('phoneVariants', () => {
  it('extrai só dígitos', () => {
    expect(digitsOnly('whatsapp:+55 (47) 99999-9999')).toBe('5547999999999');
  });

  it('número com 9º dígito gera a forma sem ele', () => {
    expect(phoneVariants('5547999999999')).toEqual(['5547999999999', '554799999999']);
  });

  it('número sem o 9º dígito gera a forma com ele', () => {
    expect(phoneVariants('554799999999')).toEqual(['554799999999', '5547999999999']);
  });

  it('número não brasileiro fica como está', () => {
    expect(phoneVariants('14155238886')).toEqual(['14155238886']);
  });
});
