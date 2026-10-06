import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @ApiPropertyOptional({ example: 'pt-BR' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 'BRL' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Chaves dos widgets exibidos na tela principal do Dashboard',
    example: ['income', 'expense', 'invested', 'leftovers'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dashboardWidgets?: string[];

  @ApiPropertyOptional({
    description: 'IDs de contas ocultadas do gráfico de Saldo por Conta no Dashboard',
    example: ['b3f1...', 'c9a2...'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dashboardHiddenAccountIds?: string[];

  @ApiPropertyOptional({ description: 'Limite de gasto do mês (null remove)', example: 5000, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySpendingLimit?: number | null;

  @ApiPropertyOptional({ description: 'Receita mensal esperada usada na Projeção (null = usar a média)', example: 6500, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  projectionExpectedIncome?: number | null;

  @ApiPropertyOptional({ description: 'Gastos do dia a dia por mês usados na Projeção', example: 1800, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  projectionFlexibleSpend?: number | null;
}
