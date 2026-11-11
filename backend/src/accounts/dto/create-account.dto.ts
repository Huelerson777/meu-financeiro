import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_ICON_LENGTH } from '../../common/utils/icon';

export class CreateAccountDto {
  @ApiProperty({ example: 'Conta Corrente Nubank' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.CHECKING })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'landmark' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ICON_LENGTH)
  icon?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Se falso, o saldo desta conta não entra no "Saldo Geral" do Dashboard',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeInDashboard?: boolean;
}
