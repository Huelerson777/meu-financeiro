import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateCardDto {
  @ApiProperty({ example: 'Nubank Roxinho' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
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
}