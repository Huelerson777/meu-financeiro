import { MailService } from './mail.service';

describe('MailService', () => {
  const originalEnv = { ...process.env };
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    delete process.env.SMTP_FROM;
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('envia pela API do Resend quando RESEND_API_KEY está definida', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.MAIL_FROM = 'PouPay <no-reply@usepoupay.com.br>';
    fetchMock.mockResolvedValue({ ok: true });

    await new MailService().send('a@b.com', 'Assunto', '<p>oi</p>');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toEqual({
      from: 'PouPay <no-reply@usepoupay.com.br>',
      to: ['a@b.com'],
      subject: 'Assunto',
      html: '<p>oi</p>',
    });
  });

  it('propaga o erro quando o Resend recusa o envio', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => 'domain not verified' });

    await expect(new MailService().send('a@b.com', 'x', 'y')).rejects.toThrow('Resend respondeu 403: domain not verified');
  });

  it('sem Resend nem SMTP, só loga e não chama a rede', async () => {
    await expect(new MailService().send('a@b.com', 'x', 'y')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
