import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { 
        account: { select: { name: true } }, 
        category: { select: { name: true, color: true } } 
      },
      orderBy: { date: 'desc' }
    });
  }

  async create(userId: string, data: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        ...data,
        userId,
        date: new Date(data.date),
      }
    });
  }
}