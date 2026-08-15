import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByWhatsappNumber(whatsappNumber: string) {
    return this.prisma.user.findUnique({ where: { whatsappNumber } });
  }

  update(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  softDelete(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  // Invalida todas as sessões ativas — usado após trocar senha ou excluir a conta,
  // pra que um refresh token vazado antes desse ponto pare de funcionar.
  revokeAllRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
