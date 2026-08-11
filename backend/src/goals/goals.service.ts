import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return goal;
  }

  create(userId: string, dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateGoalDto) {
    await this.assertOwnership(id, userId);
    return this.prisma.goal.update({
      where: { id },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    await this.prisma.goal.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * "Deposita" um valor na meta, somando ao progresso atual.
   */
  async contribute(id: string, userId: string, dto: ContributeGoalDto) {
    await this.assertOwnership(id, userId);
    return this.prisma.goal.update({
      where: { id },
      data: { currentAmount: { increment: dto.amount } },
    });
  }

  private async assertOwnership(id: string, userId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    if (goal.userId !== userId) throw new ForbiddenException('Esta meta não pertence a você');
  }
}