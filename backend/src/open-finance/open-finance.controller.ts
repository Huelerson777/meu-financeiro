import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { OpenFinanceService } from './open-finance.service';
import { CreateConnectionDto, LinkAccountDto } from './dto/open-finance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('open-finance/connections')
export class OpenFinanceController {
  constructor(private readonly service: OpenFinanceService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateConnectionDto) {
    return this.service.create(user.id, dto.itemId, dto.label);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @Get(':id/accounts')
  remoteAccounts(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.remoteAccounts(user.id, id);
  }

  @Put(':id/links')
  link(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: LinkAccountDto) {
    return this.service.link(user.id, id, dto.pluggyAccountId, dto.accountId);
  }

  @Delete(':id/links/:pluggyAccountId')
  @HttpCode(204)
  unlink(@CurrentUser() user: { id: string }, @Param('id') id: string, @Param('pluggyAccountId') pluggyAccountId: string) {
    return this.service.unlink(user.id, id, pluggyAccountId);
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.sync(user.id, id);
  }
}
