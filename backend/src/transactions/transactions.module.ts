import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionParserService } from './transaction-parser.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionParserService],
  exports: [TransactionsService],
})
export class TransactionsModule {}