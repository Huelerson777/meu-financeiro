import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Cards principais: saldo, receitas, despesas, cartões, metas' })
  getSummary(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getSummary(user.id);
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
