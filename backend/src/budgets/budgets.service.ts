import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * TODO: Implementar seguindo exatamente o padrão do módulo AccountsModule
 * (Repository Pattern + Service + DTOs de create/update + paginação).
 * Este é um esqueleto funcional pronto para receber a lógica de negócio.
 */
@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}
}
