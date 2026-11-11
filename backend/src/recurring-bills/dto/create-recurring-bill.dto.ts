import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../common/utils/money';

export class CreateRecurringBillDto {
  @ApiProperty({ example: 'Aluguel' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Conta padrão sugerida ao pagar (pode ser trocada na hora do pagamento)' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Valor padrão sugerido todo mês. Se vazio, usa o valor do último pagamento.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  defaultAmount?: number;

  @ApiProperty({ description: 'Dia do vencimento (1-31)', example: 10 })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay: number;

  @ApiPropertyOptional({ enum: ['EXPENSE', 'INCOME'], description: 'EXPENSE (padrão) = conta a pagar; INCOME = receita recorrente' })
  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: 'EXPENSE' | 'INCOME';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
