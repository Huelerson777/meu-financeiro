import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateRecurringPurchaseDto {
  @ApiProperty({ example: 'Apple One' })
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiProperty({ example: 5.9, description: 'Valor cobrado todo mês' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 5, description: 'Dia do mês em que a cobrança acontece (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  chargeDay!: number;

  @ApiPropertyOptional({ description: 'Categoria da despesa' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
