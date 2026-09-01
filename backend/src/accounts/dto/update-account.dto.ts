import { PartialType } from '@nestjs/swagger';
import { CreateAccountDto } from './create-account.dto';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({
    description:
      'Correção manual do saldo atual da conta (ex: ajuste após divergência). Diferente de initialBalance, que só se aplica na criação.',
    example: 310,
  })
  @IsOptional()
  @IsNumber()
  currentBalance?: number;
}
