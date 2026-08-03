import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.transactionsService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(user.id, createTransactionDto);
  }
}