import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InvestmentsService } from './investments.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@ApiTags('Investments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get('contributions')
  @ApiOperation({ summary: 'Histórico de aportes (transferências para contas de investimento)' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getContributions(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.investmentsService.getContributions(user.id, { startDate, endDate });
  }

  @Post('positions')
  @ApiOperation({ summary: 'Registra um aporte vinculado a um ativo específico (CDB, ação...)' })
  createPosition(@CurrentUser() user: { id: string }, @Body() dto: CreatePositionDto) {
    return this.investmentsService.createPosition(user.id, dto);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Lista as posições, recalculando o valor atual de cada uma' })
  listPositions(@CurrentUser() user: { id: string }) {
    return this.investmentsService.listPositions(user.id);
  }

  @Patch('positions/:id')
  @ApiOperation({ summary: 'Edita campos manuais de uma posição' })
  updatePosition(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.investmentsService.updatePosition(id, user.id, dto);
  }

  @Delete('positions/:id')
  @ApiOperation({ summary: 'Exclui a posição e o aporte que a originou' })
  deletePosition(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.investmentsService.deletePosition(id, user.id);
  }
}
