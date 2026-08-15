import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionParserService } from './transaction-parser.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ParseTransactionDto } from './dto/parse-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
    @Query('amount') amount?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll(user.id, {
      startDate,
      endDate,
      search,
      categoryId,
      types: type ? (type.split(',') as ('INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT')[]) : undefined,
      amount,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('suggest-category')
  suggestCategory(@CurrentUser() user: { id: string }, @Query('description') description?: string) {
    return this.transactionsService.suggestCategory(user.id, description ?? '');
  }

  @Post('parse')
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
