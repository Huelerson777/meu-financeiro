import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Conta Corrente Nubank' })
  @IsString()
  @MinLength(2)
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
  icon?: string;
}
