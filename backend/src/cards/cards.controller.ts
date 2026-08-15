import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PayInstallmentDto } from './dto/pay-installment.dto';
import { PayInstallmentsBatchDto } from './dto/pay-installments-batch.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';

@ApiTags('Cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.cardsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.cardsService.findOne(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateCardDto) {
    return this.cardsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateCardDto) {
    return this.cardsService.update(id, user.id, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.cardsService.archive(id, user.id);
  }

  // DEPOIS
  @Post(':id/purchases')
  createPurchase(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.cardsService.createPurchase(id, user.id, dto);
  }

  @Get(':id/invoices')
  getInvoices(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.cardsService.getInvoices(id, user.id);
  }

  @Patch('purchases/:groupId')
  updatePurchase(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.cardsService.updatePurchase(groupId, user.id, dto);
  }

  @Delete('purchases/:groupId')
  deletePurchase(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.cardsService.deletePurchase(groupId, user.id);
  }

  @Patch('installments/pay-batch')
  payInstallmentsBatch(@CurrentUser() user: { id: string }, @Body() dto: PayInstallmentsBatchDto) {
    return this.cardsService.payInstallmentsBatch(user.id, dto);
  }

  @Patch('installments/:id/pay')
  payInstallment(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: PayInstallmentDto,
  ) {
    return this.cardsService.payInstallment(id, user.id, dto);
  }

  @Patch('installments/:id/unpay')
  unpayInstallment(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.cardsService.unpayInstallment(id, user.id);
  }

  @Post(':id/invoices/pay')
  payInvoice(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.cardsService.payInvoice(id, user.id, dto);
  }
}