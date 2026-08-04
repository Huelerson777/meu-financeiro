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
  @ApiOperation({ summary: 'Cards principais: saldo, receitas, despesas, cartões, metas, sobras' })
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
  @ApiOperation({ summary: 'Dados de evolução para o gráfico de linha do tempo' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getMonthlyFlow(
    @CurrentUser() user: { id: string },
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getMonthlyFlow(user.id, year ? parseInt(year, 10) : undefined);
  }

  @Get('expenses-by-category')
  @ApiOperation({ summary: 'Dados para o gráfico de gastos por categoria' })
  getExpensesByCategory(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getExpensesByCategory(user.id);
  }

  @Get('upcoming-bills')
  @ApiOperation({ summary: 'Contas a pagar mais próximas do vencimento' })
  getUpcomingBills(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getUpcomingBills(user.id);
  }
}