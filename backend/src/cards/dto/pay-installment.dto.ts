import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PayInstallmentDto {
  @ApiProperty({ description: 'Conta bancária de onde o valor vai sair' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({ description: 'Data do pagamento (default: agora)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
