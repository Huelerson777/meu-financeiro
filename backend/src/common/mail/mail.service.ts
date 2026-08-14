import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Envio de e-mail transacional. Se as variáveis SMTP_* não estiverem
 * configuradas (dev local, ou produção ainda sem provedor definido), cai
 * num modo "dry run" que só loga o conteúdo — assim o fluxo de recuperação
 * de senha continua testável ponta a ponta sem depender de credenciais
 * reais de e-mail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  }

  async send(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP não configurado — e-mail não enviado de verdade. Para: ${to} | Assunto: ${subject}\n${html}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'FinanceFlow <no-reply@financeflow.app>',
      to,
      subject,
      html,
    });
  }
}
