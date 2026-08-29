import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCreditDto {
  @ApiProperty({ example: 'Estorno - compra cancelada' })
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiProperty({ example: 150.9, description: 'Valor do crédito/estorno (sempre positivo, é descontado da fatura)' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: '2026-09-10', description: 'Data em que o crédito entra — define em qual fatura ele cai' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'Categoria associada ao crédito' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
