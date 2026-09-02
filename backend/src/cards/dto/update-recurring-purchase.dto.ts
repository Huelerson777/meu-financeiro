import { PartialType } from '@nestjs/swagger';
import { CreateRecurringPurchaseDto } from './create-recurring-purchase.dto';

export class UpdateRecurringPurchaseDto extends PartialType(CreateRecurringPurchaseDto) {}
