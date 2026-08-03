import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  fromAccountId: string;

  @ApiProperty()
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
