import { IsString, MaxLength, MinLength } from 'class-validator';

export class ParseTransactionDto {
  @IsString()
  @MinLength(3)
  // O texto vai inteiro pra API de IA (custo por token): uma frase de lançamento não precisa de mais que isso.
  @MaxLength(500)
  text: string;
}
