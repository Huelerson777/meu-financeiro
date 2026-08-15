import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateRecurringBillDto {
  @ApiProperty({ example: 'Aluguel' })
  @IsString()
  @MinLength(2)
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
  defaultAmount?: number;

  @ApiProperty({ description: 'Dia do vencimento (1-31)', example: 10 })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
