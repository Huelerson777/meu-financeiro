import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackQueryDto } from './dto/feedback-query.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateFeedbackDto) {
    return this.prisma.feedback.create({
      data: { userId, screen: dto.screen, message: dto.message },
    });
  }

  /**
   * Lista todos os feedbacks recebidos (todos os usuários) — endpoint só pra
   * ADMIN, protegido pelo RolesGuard no controller.
   */
  async findAll(query: FeedbackQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.FeedbackWhereInput = {
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async updateStatus(id: string, dto: UpdateFeedbackDto) {
    const existing = await this.prisma.feedback.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feedback não encontrado');

    return this.prisma.feedback.update({ where: { id }, data: { status: dto.status } });
  }
}
