import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { CategoriesService } from '../categories/categories.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { MailService } from '../common/mail/mail.service';
import { verificationEmailHtml } from './email-verification.mail';

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_DAYS = 7;
const RESET_TOKEN_EXPIRES_MINUTES = 60;
const VERIFY_CODE_EXPIRES_MINUTES = 15;
const VERIFY_CODE_MAX_ATTEMPTS = 5;
const VERIFY_CODE_RESEND_COOLDOWN_SECONDS = 60;

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private categoriesService: CategoriesService,
    private mailService: MailService,
  ) {}

  /**
   * Cria a conta como "pendente": nenhum token é emitido até o e-mail ser
   * confirmado com o código enviado (ver verifyEmail). Se o e-mail já existe
   * mas nunca foi confirmado, o cadastro é refeito em cima dele — senão
   * qualquer um poderia "queimar" o e-mail de outra pessoa cadastrando antes.
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && (existing.emailVerifiedAt || !existing.emailVerificationRequired)) {
      throw new ConflictException('Já existe uma conta com este e-mail');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let user;
    if (existing) {
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { name: dto.name, passwordHash },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          settings: { create: {} },
        },
      });
    }

    await this.sendVerificationCode(user, { force: true });

    return { requiresVerification: true, email: user.email };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    if (user.emailVerificationRequired && !user.emailVerifiedAt) {
      // Reenvia o código (respeitando o intervalo mínimo) pra quem fechou a
      // tela de verificação sem terminar — o front leva direto pra ela.
      // Falha de envio não pode mascarar o 403 — o usuário ainda pode pedir
      // o reenvio na tela de verificação.
      await this.sendVerificationCode(user).catch(() => undefined);
      throw new ForbiddenException({
        message: 'Confirme seu e-mail para entrar. Enviamos um código para a sua caixa de entrada.',
        code: EMAIL_NOT_VERIFIED,
      });
    }

    await this.categoriesService.ensureDefaults(user.id);

    return this.issueTokens(user.id, user.email, user.role, dto.rememberMe);
  }

  /**
   * Confere o código de 6 dígitos. Em caso de sucesso marca o e-mail como
   * verificado e devolve os tokens (contas novas ainda não têm sessão).
   * Contas já verificadas recebem erro genérico — este endpoint é público
   * e nunca pode virar um "login só com o e-mail".
   */
  async verifyEmail(email: string, code: string) {
    const invalid = new BadRequestException('Código inválido ou expirado');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || !user.isActive) throw invalid;

    const stored = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!stored || stored.expiresAt < new Date()) throw invalid;

    if (stored.attempts >= VERIFY_CODE_MAX_ATTEMPTS) {
      throw new BadRequestException('Muitas tentativas. Peça um novo código.');
    }

    const expected = Buffer.from(stored.codeHash, 'hex');
    const received = Buffer.from(this.hashCode(user.id, code), 'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      await this.prisma.emailVerificationCode.update({
        where: { id: stored.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } }),
    ]);

    await this.categoriesService.ensureDefaults(user.id);

    return this.issueTokens(user.id, user.email, user.role);
  }

  /** Reenvia o código. Resposta sempre igual, exista a conta ou não. */
  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && !user.emailVerifiedAt) {
      await this.sendVerificationCode(user);
    }
    return { message: 'Se este e-mail estiver aguardando verificação, enviamos um novo código.' };
  }

  /**
   * Gera um código novo (invalidando os anteriores) e envia por e-mail.
   * Sem `force`, respeita um intervalo mínimo entre envios pra não virar
   * disparador de spam; o cadastro usa `force` porque é o primeiro envio.
   */
  async sendVerificationCode(
    user: { id: string; name: string; email: string },
    options: { force?: boolean } = {},
  ) {
    if (!options.force) {
      const last = await this.prisma.emailVerificationCode.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (last && Date.now() - last.createdAt.getTime() < VERIFY_CODE_RESEND_COOLDOWN_SECONDS * 1000) {
        return;
      }
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.emailVerificationCode.create({
        data: {
          userId: user.id,
          codeHash: this.hashCode(user.id, code),
          expiresAt: new Date(Date.now() + VERIFY_CODE_EXPIRES_MINUTES * 60 * 1000),
        },
      }),
    ]);

    try {
      await this.mailService.send(
        user.email,
        `${code} é o seu código de verificação — PouPay`,
        verificationEmailHtml(user.name, code, VERIFY_CODE_EXPIRES_MINUTES),
      );
    } catch (error) {
      this.logger.error(`Falha ao enviar o código de verificação para ${user.email}: ${(error as Error).message}`);
      // Sem o e-mail o código é inútil — apaga pra o intervalo mínimo de
      // reenvio não travar a próxima tentativa.
      await this.prisma.emailVerificationCode
        .deleteMany({ where: { userId: user.id } })
        .catch(() => undefined);
      throw new ServiceUnavailableException('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
    }
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    // Rotaciona o refresh token (revoga o antigo, emite um novo)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
    return { message: 'Sessão encerrada com sucesso' };
  }

  /**
   * Gera um token de recuperação e envia por e-mail. Sempre retorna a mesma
   * mensagem de sucesso, exista ou não o e-mail — evita que alguém use este
   * endpoint pra descobrir quais e-mails estão cadastrados no sistema.
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000),
        },
      });

      const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`;
      await this.mailService.send(
        user.email,
        'Recuperação de senha — PouPay',
        `<p>Olá, ${user.name}.</p>` +
          `<p>Clique no link abaixo para redefinir sua senha. Ele expira em ${RESET_TOKEN_EXPIRES_MINUTES} minutos.</p>` +
          `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
          `<p>Se você não pediu essa recuperação, pode ignorar este e-mail.</p>`,
      );
    }

    return { message: 'Se este e-mail existir na nossa base, enviamos um link de recuperação.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.used || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Link de recuperação inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { used: true } }),
      // Redefinir a senha encerra todas as sessões ativas, por segurança
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    return { message: 'Senha redefinida com sucesso' };
  }

  private async issueTokens(userId: string, email: string, role: string, rememberMe = false) {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: ACCESS_EXPIRES_IN,
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresInDays = rememberMe ? REFRESH_EXPIRES_DAYS * 4 : REFRESH_EXPIRES_DAYS;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  // HMAC com o JWT_SECRET: um código de 6 dígitos tem só 1M de combinações,
  // então um hash simples vazado seria quebrado na hora.
  private hashCode(userId: string, code: string): string {
    return crypto
      .createHmac('sha256', process.env.JWT_SECRET ?? '')
      .update(`${userId}:${code}`)
      .digest('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
