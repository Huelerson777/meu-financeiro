import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class PayInvoiceDto {
  @ApiProperty({ description: 'Conta bancária de onde o valor vai sair' })
  @IsUUID()
  accountId!: string;

  @ApiProperty({ example: '2026-09', description: 'Mês da fatura (YYYY-MM)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @ApiPropertyOptional({ description: 'Data do pagamento (default: agora)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
