import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // Sem diferenciar maiúsculas: contas antigas podem ter o e-mail salvo como "Maria@Email.com".
  findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  }

  findByWhatsappNumber(whatsappNumber: string) {
    return this.prisma.user.findUnique({ where: { whatsappNumber } });
  }

  update(id: string, data: Omit<UpdateUserDto, 'currentPassword'> & { emailVerifiedAt?: Date | null }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /**
   * Apaga a conta e tudo que é dela. O resto sai em cascata junto com o
   * usuário; só dois casos precisam ir antes, na mão:
   * - investments → accounts é ON DELETE RESTRICT (a cascata das contas falharia);
   * - logs → users é SET NULL (ficariam órfãos, com corpos de requisição do usuário).
   */
  deleteWithAllData(id: string) {
    return this.prisma.$transaction([
      this.prisma.investment.deleteMany({ where: { userId: id } }),
      this.prisma.log.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }

  // Invalida todas as sessões ativas — usado após trocar senha ou excluir a conta,
  // pra que um refresh token vazado antes desse ponto pare de funcionar.
  revokeAllRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  // Acessos concedidos a apps via MCP valem 90 dias e não dependem da senha:
  // precisam cair junto quando a senha muda ou a conta é excluída.
  revokeAllMcpTokens(userId: string) {
    return this.prisma.mcpToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
