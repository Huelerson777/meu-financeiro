import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InvestmentsService } from './investments.service';

@ApiTags('Investments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get('contributions')
  @ApiOperation({ summary: 'Histórico de aportes (transferências para contas de investimento)' })
  getContributions(@CurrentUser() user: { id: string }) {
    return this.investmentsService.getContributions(user.id);
  }
}
