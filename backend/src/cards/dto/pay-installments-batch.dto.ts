import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PayInstallmentsBatchDto {
  @ApiProperty({ description: 'IDs das parcelas a pagar juntas', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  installmentIds!: string[];

  @ApiProperty({ description: 'Conta bancária de onde o valor vai sair' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({ description: 'Data do pagamento (default: agora)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
