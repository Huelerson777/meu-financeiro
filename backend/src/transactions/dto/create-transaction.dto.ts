import { IsString, IsNumber, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class CreateTransactionDto {
  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsDateString()
  date: string;
}