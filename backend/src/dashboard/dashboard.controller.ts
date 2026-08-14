import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Cards principais: saldo, receitas, despesas, investimentos, sobras' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getSummary(
    @CurrentUser() user: { id: string },
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getSummary(
      user.id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('monthly-flow')
  @ApiOperation({ summary: 'Dados de evolução anual para o gráfico de área' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getMonthlyFlow(
    @CurrentUser() user: { id: string },
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getMonthlyFlow(
      user.id,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('expenses-by-category')
  @ApiOperation({ summary: 'Despesas agrupadas por categoria com nome e cor (ITEM 7)' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getExpensesByCategory(
    @CurrentUser() user: { id: string },
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getExpensesByCategory(
      user.id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('upcoming-bills')
  @ApiOperation({ summary: 'Contas a pagar mais próximas do vencimento' })
  getUpcomingBills(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getUpcomingBills(user.id);
  }

  @Get('payments-status')
  @ApiOperation({ summary: 'Pago x Em Aberto: totais e itens pendentes do mês' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getPaymentsStatus(
    @CurrentUser() user: { id: string },
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getPaymentsStatus(
      user.id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('net-worth-trend')
  @ApiOperation({ summary: 'Patrimônio total (todas as contas) no fim de cada um dos últimos N meses' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  getNetWorthTrend(@CurrentUser() user: { id: string }, @Query('months') months?: string) {
    return this.dashboardService.getNetWorthTrend(user.id, months ? parseInt(months, 10) : undefined);
  }

  @Get('goals-summary')
  @ApiOperation({ summary: 'Resumo de progresso das metas para o widget do dashboard' })
  getGoalsSummary(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getGoalsSummary(user.id);
  }
}
