import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination-query.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  create(userId: string, dto: CreateAccountDto) {
    return this.accountsRepository.create(userId, dto);
  }

  async findAll(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<any>> {
    const skip = (query.page - 1) * query.limit;

    const { items, total } = await this.accountsRepository.findManyPaginated({
      userId,
      skip,
      take: query.limit,
      search: query.search,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    });

    return {
      items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, userId: string) {
    const account = await this.accountsRepository.findById(id, userId);
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }

  async update(id: string, userId: string, dto: UpdateAccountDto) {
    await this.ensureOwnership(id, userId);
    return this.accountsRepository.update(id, dto);
  }

  async archive(id: string, userId: string) {
    await this.ensureOwnership(id, userId);
    return this.accountsRepository.archive(id);
  }

  async transfer(userId: string, dto: CreateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Acesso negado: A conta de origem e destino devem ser diferentes');
    }

    const fromAccount = await this.ensureOwnership(dto.fromAccountId, userId);

    if (Number(fromAccount.currentBalance) < dto.amount) {
      throw new BadRequestException('Saldo insuficiente para realizar a transferência');
    }

    await this.ensureOwnership(dto.toAccountId, userId);

    return this.accountsRepository.createTransfer({
      userId, 
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      description: dto.description,
    });
  }

  async updateTransfer(id: string, userId: string, dto: UpdateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('A conta de origem e destino devem ser diferentes');
    }

    const existing = await this.accountsRepository.findTransferById(id);
    if (!existing) throw new NotFoundException('Transferência não encontrada');
    if (existing.fromAccount.userId !== userId || existing.toAccount.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    // Garante que as novas contas escolhidas também são suas
    await this.ensureOwnership(dto.fromAccountId, userId);
    await this.ensureOwnership(dto.toAccountId, userId);

    return this.accountsRepository.updateTransfer({
      id,
      oldFromId: existing.fromId,
      oldToId: existing.toId,
      oldAmount: Number(existing.amount),
      newFromId: dto.fromAccountId,
      newToId: dto.toAccountId,
      newAmount: dto.amount,
      description: dto.description,
      date: dto.date ? new Date(dto.date) : undefined,
    });
  }

  async removeTransfer(id: string, userId: string) {
    const existing = await this.accountsRepository.findTransferById(id);
    if (!existing) throw new NotFoundException('Transferência não encontrada');
    if (existing.fromAccount.userId !== userId || existing.toAccount.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.accountsRepository.deleteTransfer({
      id,
      fromId: existing.fromId,
      toId: existing.toId,
      amount: Number(existing.amount),
    });
  }

  async getTotalBalance(userId: string) {
    const result = await this.accountsRepository.getTotalBalance(userId);
    return { total: result._sum.currentBalance ?? 0 };
  }

  private async ensureOwnership(accountId: string, userId: string) {
    const account = await this.accountsRepository.findById(accountId, userId);
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (account.userId !== userId) throw new ForbiddenException('Acesso negado');
    return account;
  }
}