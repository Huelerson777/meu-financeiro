import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class ContributeGoalDto {
  @ApiProperty({ example: 200, description: 'Valor a somar no progresso da meta' })
  @IsNumber()
  @IsPositive()
  amount!: number;
}