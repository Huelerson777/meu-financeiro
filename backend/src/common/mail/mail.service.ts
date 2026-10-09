import { Injectable, Logger } from '@nestjs/common';
import { isIP } from 'net';
import { resolve4 } from 'dns/promises';
import * as nodemailer from 'nodemailer';

const DEFAULT_FROM = 'PouPay <no-reply@usepoupay.com.br>';

/**
 * Envio de e-mail transacional. Com RESEND_API_KEY envia pela API HTTPS do
 * Resend — o Render (plano gratuito) bloqueia saída para as portas SMTP
 * 25/465/587, então SMTP não funciona lá. Sem a chave, usa SMTP_* se houver
 * (dev local ou hospedagem sem bloqueio). Sem nenhum dos dois, cai num modo
 * "dry run" que só loga o conteúdo — assim o fluxo de verificação e de
 * recuperação de senha continua testável sem credenciais reais.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(to: string, subject: string, html: string) {
    if (process.env.RESEND_API_KEY) {
      return this.sendWithResend(process.env.RESEND_API_KEY, to, subject, html);
    }

    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn(
        `SMTP não configurado — e-mail não enviado de verdade. Para: ${to} | Assunto: ${subject}\n${html}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host: await this.resolveIPv4(host),
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      // Conectando pelo IP, o certificado TLS ainda precisa ser validado
      // contra o nome real do servidor.
      tls: { servername: host },
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      // Sem isso o nodemailer espera ~2 min numa porta bloqueada e a
      // requisição (cadastro/reenvio de código) fica pendurada.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? DEFAULT_FROM,
      to,
      subject,
      html,
    });
  }

  private async sendWithResend(apiKey: string, to: string, subject: string, html: string) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? DEFAULT_FROM, to: [to], subject, html }),
      // Sem limite, um provedor lento deixa cadastro/reenvio de código pendurados.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend respondeu ${response.status}: ${detail.slice(0, 300)}`);
    }
  }

  /**
   * O Render não tem saída por IPv6 e o Node tenta o endereço IPv6 do
   * Gmail primeiro (ENETUNREACH). Resolve o IPv4 na mão; se falhar, segue
   * com o nome do host e deixa o erro real aparecer no envio.
   */
  private async resolveIPv4(host: string): Promise<string> {
    if (isIP(host)) return host;
    try {
      const [address] = await resolve4(host);
      return address ?? host;
    } catch {
      return host;
    }
  }
}
