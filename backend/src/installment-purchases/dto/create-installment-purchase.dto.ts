import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateInstallmentPurchaseDto {
  @ApiProperty({ example: 'Financiamento do carro' })
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiProperty({ example: 850, description: 'Valor de CADA parcela' })
  @IsNumber()
  @IsPositive()
  installmentAmount!: number;

  @ApiProperty({ example: 60, description: 'Total de parcelas do parcelamento' })
  @IsInt()
  @Min(1)
  @Max(600)
  totalInstallments!: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Número da primeira parcela a ser lançada agora (ex: 5 se você já pagou 1 a 4 fora do sistema e está começando a acompanhar a partir da 5ª). Default: 1.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  startInstallment?: number;

  @ApiProperty({ example: '2026-09-10', description: 'Data de vencimento da parcela inicial (startInstallment)' })
  @IsDateString()
  firstDueDate!: string;

  @ApiPropertyOptional({ description: 'Categoria da despesa' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Conta sugerida para pagamento (pode ser trocada na hora de pagar cada parcela)' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
