import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecurringBillsService } from './recurring-bills.service';
import { CreateRecurringBillDto } from './dto/create-recurring-bill.dto';
import { UpdateRecurringBillDto } from './dto/update-recurring-bill.dto';

@ApiTags('RecurringBills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring-bills')
export class RecurringBillsController {
  constructor(private readonly recurringBillsService: RecurringBillsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as contas fixas do usuário' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.recurringBillsService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra uma nova conta fixa (ex: aluguel, internet, energia)' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateRecurringBillDto) {
    return this.recurringBillsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza ou reativa/pausa uma conta fixa' })
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateRecurringBillDto) {
    return this.recurringBillsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Pausa uma conta fixa (não gera mais lançamentos)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.recurringBillsService.remove(id, user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Gera o lançamento pendente do mês corrente para cada conta fixa ativa (idempotente)' })
  sync(@CurrentUser() user: { id: string }) {
    return this.recurringBillsService.sync(user.id);
  }
}
