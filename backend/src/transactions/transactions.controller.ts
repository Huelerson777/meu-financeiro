import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TransactionStatus } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { TransactionParserService } from './transaction-parser.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ParseTransactionDto } from './dto/parse-transaction.dto';
import { ImportPreviewDto, ImportTransactionsDto } from './dto/import-transactions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const TYPE_FILTERS = ['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros da listagem vêm da URL: valor fora do esperado vira 400 claro, não um erro 500 do banco. */
function parseDay(name: string, value?: string): string | undefined {
  if (!value) return undefined;
  if (!ISO_DAY.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new BadRequestException(`${name} deve estar no formato AAAA-MM-DD`);
  }
  return value;
}

function parseTypes(value?: string): TypeFilter[] | undefined {
  if (!value) return undefined;
  const types = value.split(',').map((t) => t.trim()).filter(Boolean);
  if (types.some((t) => !TYPE_FILTERS.includes(t as TypeFilter))) {
    throw new BadRequestException(`type aceita: ${TYPE_FILTERS.join(', ')}`);
  }
  return types as TypeFilter[];
}

function parseStatus(value?: string): TransactionStatus | undefined {
  if (!value) return undefined;
  if (!(value in TransactionStatus)) throw new BadRequestException('status aceita: PAID, PENDING, OVERDUE');
  return value as TransactionStatus;
}

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly transactionParserService: TransactionParserService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('amount') amount?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll(user.id, {
      startDate: parseDay('startDate', startDate),
      endDate: parseDay('endDate', endDate),
      search,
      categoryId,
      types: parseTypes(type),
      status: parseStatus(status),
      // Busca "contém" no valor: só dígitos e separador decimal (vírgula vira ponto, como o banco guarda).
      amount: amount?.replace(/,/g, '.').replace(/[^0-9.]/g, '') || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('import/preview')
  previewImport(@CurrentUser() user: { id: string }, @Body() dto: ImportPreviewDto) {
    return this.transactionsService.previewImport(user.id, dto);
  }

  @Post('import')
  importTransactions(@CurrentUser() user: { id: string }, @Body() dto: ImportTransactionsDto) {
    return this.transactionsService.importTransactions(user.id, dto);
  }

  @Get('suggest-category')
  suggestCategory(@CurrentUser() user: { id: string }, @Query('description') description?: string) {
    return this.transactionsService.suggestCategory(user.id, description ?? '');
  }

  // Cada chamada vai pra API de IA (custo por uso): limite bem abaixo do global.
  @Post('parse')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  parse(@CurrentUser() user: { id: string }, @Body() dto: ParseTransactionDto) {
    return this.transactionParserService.parse(user.id, dto.text);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(user.id, createTransactionDto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, user.id, updateTransactionDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.transactionsService.remove(id, user.id);
  }
}
