import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../common/utils/money';
import { MAX_ICON_LENGTH } from '../../common/utils/icon';

export class CreateCardDto {
  @ApiProperty({ example: 'Nubank Roxinho' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  limitAmount!: number;

  @ApiProperty({ example: 10, description: 'Dia do mês em que a fatura fecha (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay!: number;

  @ApiProperty({ example: 17, description: 'Dia do mês em que a fatura vence (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

  @ApiPropertyOptional({ example: '#8B5CF6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Logo do cartão (data URL de imagem pequena); null/vazio remove' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ICON_LENGTH)
  icon?: string | null;
}
