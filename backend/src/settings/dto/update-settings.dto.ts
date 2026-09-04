import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

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
}