import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InstallmentPurchasesService } from './installment-purchases.service';
import { CreateInstallmentPurchaseDto } from './dto/create-installment-purchase.dto';

@ApiTags('InstallmentPurchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('installment-purchases')
export class InstallmentPurchasesController {
  constructor(private readonly service: InstallmentPurchasesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os parcelamentos fora do cartão (financiamentos, boletos parcelados...)' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.service.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um parcelamento fora do cartão, podendo começar a partir de uma parcela específica' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateInstallmentPurchaseDto) {
    return this.service.create(user.id, dto);
  }

  @Delete(':groupId')
  @ApiOperation({ summary: 'Exclui definitivamente um parcelamento (todas as parcelas)' })
  remove(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.service.remove(groupId, user.id);
  }

  // Pagar/desfazer pagamento de uma parcela: ver PATCH /cards/installments/:id/pay
  // e /unpay — endpoint já genérico, reaproveitado aqui (mesmo usado pelo Dashboard).
}
