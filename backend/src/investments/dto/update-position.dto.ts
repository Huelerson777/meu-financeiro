import { ApiPropertyOptional } from '@nestjs/swagger';
import { Indexer } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdatePositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Ticker B3 — só STOCK/FUND' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional({ enum: Indexer })
  @IsOptional()
  @IsEnum(Indexer)
  indexer?: Indexer;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Preço/valor atual manual — categorias sem fonte automática (CRYPTO/REAL_ESTATE/OTHER), ou para sobrescrever' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  currentPrice?: number;

  @ApiPropertyOptional({ description: 'Quantidade de cotas/ações — só STOCK/FUND' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;
}
