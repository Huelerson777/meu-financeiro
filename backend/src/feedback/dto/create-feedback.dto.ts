import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({ example: 'Contas', description: 'Tela/aba sobre a qual o feedback é' })
  @IsString()
  @MinLength(2)
  screen!: string;

  @ApiProperty({ example: 'Erro no cadastro de conta: ao salvar, o saldo não aparece.' })
  @IsString()
  @MinLength(5)
  message!: string;
}
