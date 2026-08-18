import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { LogsQueryDto } from './dto/logs-query.dto';

export interface AuditEntry {
  userId: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger('Audit');

  constructor(private prisma: PrismaService) {}

  /**
   * Grava um evento de auditoria. Best-effort e fire-and-forget de
   * propósito: uma falha aqui nunca pode derrubar a requisição real que a
   * originou — só vai pro log de erro do servidor.
   */
  record(entry: AuditEntry) {
    this.prisma.log
      .create({
        data: {
          userId: entry.userId,
          action: entry.action,
          metadata: entry.metadata as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress ?? null,
        },
      })
      .catch((err) => this.logger.warn(`Falha ao gravar log de auditoria: ${err.message}`));
  }

  async findAll(userId: string, query: LogsQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.LogWhereInput = {
      userId,
      ...(query.action && { action: { startsWith: query.action } }),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(query.to) }),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.log.findMany({ where, skip, take: query.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.log.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
