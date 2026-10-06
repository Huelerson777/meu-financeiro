import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

export class UpsertBudgetDto {
  @ApiProperty({ description: 'Categoria de despesa do orçamento' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 10, description: 'Mês (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 800, description: 'Valor planejado para a categoria no mês' })
  @IsNumber()
  @Min(0.01)
  amount: number;
}
