import { Module } from '@nestjs/common';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { BacenService } from './rate-sources/bacen.service';
import { BrapiService } from './rate-sources/brapi.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, BacenService, BrapiService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
