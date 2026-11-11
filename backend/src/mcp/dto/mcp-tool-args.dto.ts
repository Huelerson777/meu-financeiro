import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../common/utils/money';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Argumentos das tools MCP. O ValidationPipe global só roda em controllers
 * HTTP; as tools chamam os Services direto, então sem estes DTOs um valor
 * negativo, uma data torta ou "amount" como texto (quem preenche é um modelo
 * de linguagem) ia parar no banco e no saldo das contas.
 */
export class McpTransactionEntryDto {
  @IsIn(['EXPENSE', 'INCOME', 'TRANSFER', 'INVESTMENT'])
  type!: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsNumber()
  @IsPositive()
  @Max(MAX_MONEY_AMOUNT)
  amount!: number;

  @Matches(ISO_DAY, { message: 'date deve estar no formato AAAA-MM-DD' })
  date!: string;

  @IsOptional()
  @IsIn(['PAID', 'PENDING'])
  status?: 'PAID' | 'PENDING';

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  accountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  toAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export const MCP_MAX_BATCH = 200;

export class McpTransactionsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MCP_MAX_BATCH)
  transactions!: unknown[];
}

export class McpSearchTransactionsDto {
  @IsOptional()
  @Matches(ISO_DAY, { message: 'startDate deve estar no formato AAAA-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'endDate deve estar no formato AAAA-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^\d{1,12}([.,]\d{0,2})?$/, { message: 'amount deve conter só dígitos (ex: "15" ou "15.90")' })
  amount?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(['EXPENSE', 'INCOME', 'TRANSFER', 'INVESTMENT'], { each: true })
  types?: ('EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT')[];

  @IsOptional()
  @IsIn(['PAID', 'PENDING', 'OVERDUE'])
  status?: 'PAID' | 'PENDING' | 'OVERDUE';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
