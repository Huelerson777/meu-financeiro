import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LogsService } from './logs.service';
import { LogsQueryDto } from './dto/logs-query.dto';

@ApiTags('Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Histórico de auditoria (criações, alterações e exclusões) do usuário autenticado',
  })
  findAll(@CurrentUser() user: { id: string }, @Query() query: LogsQueryDto) {
    return this.logsService.findAll(user.id, query);
  }
}
