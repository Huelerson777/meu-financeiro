import { PartialType } from '@nestjs/swagger';
import { CreateRecurringBillDto } from './create-recurring-bill.dto';

export class UpdateRecurringBillDto extends PartialType(CreateRecurringBillDto) {}
