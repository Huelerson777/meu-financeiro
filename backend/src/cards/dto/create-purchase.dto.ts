import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ example: 'Notebook novo' })
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiProperty({ example: 2700, description: 'Valor TOTAL da compra (não o valor de cada parcela)' })
  @IsNumber()
  @IsPositive()
  totalAmount!: number;

  @ApiProperty({ example: 3, description: 'Em quantas parcelas' })
  @IsInt()
  @Min(1)
  @Max(48)
  installmentsCount!: number;

  @ApiProperty({ example: '2026-08-15', description: 'Data da compra' })
  @IsDateString()
  purchaseDate!: string;

  @ApiPropertyOptional({ description: 'Categoria da despesa (ex: Mercado, Lazer...)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}