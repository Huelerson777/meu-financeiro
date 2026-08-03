import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma nova conta financeira' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as contas do usuário (paginado, pesquisável, ordenável)' })
  findAll(@CurrentUser() user: { id: string }, @Query() query: PaginationQueryDto) {
    return this.accountsService.findAll(user.id, query);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Retorna o saldo total consolidado de todas as contas' })
  getTotalBalance(@CurrentUser() user: { id: string }) {
    return this.accountsService.getTotalBalance(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.accountsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Arquiva (soft delete) uma conta' })
  archive(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.accountsService.archive(id, user.id);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfere valor entre duas contas do usuário' })
  transfer(@CurrentUser() user: { id: string }, @Body() dto: CreateTransferDto) {
    return this.accountsService.transfer(user.id, dto);
  }
}
