import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min,
  ValidateNested,
} from 'class-validator';

export const MAX_IMPORT_ROWS = 500;

export class ImportPreviewRowDto {
  @IsDateString()
  date: string;

  @IsString()
  @MaxLength(200)
  description: string;

  /** Valor com sinal: positivo = entrada, negativo = saída. */
  @IsNumber()
  amount: number;
}

export class ImportPreviewDto {
  @IsString()
  accountId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportPreviewRowDto)
  rows: ImportPreviewRowDto[];
}

export class ImportRowDto {
  @IsDateString()
  date: string;

  @IsString()
  @MaxLength(200)
  description: string;

  /** Valor absoluto (> 0); o sentido vem de `type`. */
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(['INCOME', 'EXPENSE'])
  type: 'INCOME' | 'EXPENSE';

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class ImportTransactionsDto {
  @IsString()
  accountId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}
