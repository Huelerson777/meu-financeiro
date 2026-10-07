import { Module } from '@nestjs/common';
import { OpenFinanceController } from './open-finance.controller';
import { OpenFinanceService } from './open-finance.service';
import { PluggyClient } from './pluggy.client';
import { PrismaModule } from '../common/prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CardsModule } from '../cards/cards.module';

@Module({
  imports: [PrismaModule, TransactionsModule, CardsModule],
  controllers: [OpenFinanceController],
  providers: [OpenFinanceService, PluggyClient],
})
export class OpenFinanceModule {}
