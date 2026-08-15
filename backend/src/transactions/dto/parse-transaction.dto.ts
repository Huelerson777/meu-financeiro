import { IsString, MinLength } from 'class-validator';

export class ParseTransactionDto {
  @IsString()
  @MinLength(3)
  text: string;
}
