import {
  ConflictException,
  Injectable,
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

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_DAYS = 7;
const RESET_TOKEN_EXPIRES_MINUTES = 60;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private categoriesService: CategoriesService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        settings: { create: {} },
      },
    });

    await this.categoriesService.ensureDefaults(user.id);

    return this.issueTokens(user.id, user.email, user.role);
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

    await this.categoriesService.ensureDefaults(user.id);

    return this.issueTokens(user.id, user.email, user.role, dto.rememberMe);
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
        'Recuperação de senha — FinanceFlow',
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
