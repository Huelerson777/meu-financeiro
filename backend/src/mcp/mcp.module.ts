import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CardsModule } from '../cards/cards.module';
import { InvestmentsModule } from '../investments/investments.module';
import { InstallmentPurchasesModule } from '../installment-purchases/installment-purchases.module';
import { McpOAuthController } from './mcp-oauth.controller';
import { McpOAuthService } from './mcp-oauth.service';
import { McpTokenGuard } from './mcp-token.guard';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [AccountsModule, CategoriesModule, TransactionsModule, CardsModule, InvestmentsModule, InstallmentPurchasesModule],
  controllers: [McpOAuthController, McpController],
  providers: [McpOAuthService, McpTokenGuard, McpToolsService],
})
export class McpModule {}
