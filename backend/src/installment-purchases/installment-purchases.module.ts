import { Module } from '@nestjs/common';
import { InstallmentPurchasesController } from './installment-purchases.controller';
import { InstallmentPurchasesService } from './installment-purchases.service';

@Module({
  controllers: [InstallmentPurchasesController],
  providers: [InstallmentPurchasesService],
})
export class InstallmentPurchasesModule {}
