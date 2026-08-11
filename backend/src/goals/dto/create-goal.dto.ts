import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ example: 'Viagem para a praia' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  targetAmount!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}