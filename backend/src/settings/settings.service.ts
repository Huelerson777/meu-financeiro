import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca as preferências do usuário. Se ainda não existir nenhuma
   * (usuário nunca configurou nada), cria uma linha padrão na hora.
   */
  async getSettings(userId: string) {
    const existing = await this.prisma.settings.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.settings.create({
      data: { userId },
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    await this.getSettings(userId); // garante que a linha existe antes do update
    return this.prisma.settings.update({
      where: { userId },
      data: dto,
    });
  }
}