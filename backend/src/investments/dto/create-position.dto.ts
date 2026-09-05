import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvestmentCategory, Indexer } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty({ description: 'Conta de onde sai o dinheiro do aporte' })
  @IsUUID()
  fromAccountId: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
