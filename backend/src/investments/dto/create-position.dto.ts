import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvestmentCategory, Indexer } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreatePositionDto {
  @ApiPropertyOptional({
    description:
      'Conta de onde sai o dinheiro do aporte. Omita para registrar um ativo que você já possui (comprado antes, fora do app) sem mover saldo de nenhuma conta.',
  })
  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @ApiProperty({ description: 'Conta de investimento (tipo INVESTMENT) que recebe o aporte' })
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ example: 300, description: 'Valor total aportado' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'CDB Banco XP' })
  @IsString()
  name: string;

  @ApiProperty({ enum: InvestmentCategory })
  @IsEnum(InvestmentCategory)
  category: InvestmentCategory;

  @ApiPropertyOptional({ description: 'Quantidade de cotas/ações — só STOCK/FUND' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ example: 'PETR4', description: 'Ticker B3 — só STOCK/FUND, ativa a cotação automática' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional({ enum: Indexer, description: 'Só FIXED_INCOME' })
  @IsOptional()
  @IsEnum(Indexer)
  indexer?: Indexer;

  @ApiPropertyOptional({ example: 110, description: 'Taxa contratada — só FIXED_INCOME (significado depende do indexer)' })
  @IsOptional()
  @IsNumber()
  rate?: number;

  @ApiPropertyOptional({ description: 'Data de início da contagem de rendimento (AAAA-MM-DD) — só FIXED_INCOME' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data do aporte (AAAA-MM-DD), padrão hoje' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Valor atual total do ativo (não o valor investido). Útil pra registrar um ativo antigo já com o valor de hoje, sem esperar o próximo recálculo automático — ignorado se vazio (usa o valor investido como ponto de partida). Sem efeito em FIXED_INCOME, que recalcula sozinho pelo indexador/taxa.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
