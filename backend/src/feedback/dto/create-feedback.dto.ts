import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// ~7 milhões de caracteres base64 ≈ 5MB de imagem original — teto generoso
// pra um print de tela, sem deixar a requisição crescer sem limite.
const MAX_IMAGE_LENGTH = 7_000_000;

export class CreateFeedbackDto {
  @ApiProperty({ example: 'Contas', description: 'Tela/aba sobre a qual o feedback é' })
  @IsString()
  @MinLength(2)
  screen!: string;

  @ApiProperty({ example: 'Erro no cadastro de conta: ao salvar, o saldo não aparece.' })
  @IsString()
  @MinLength(5)
  message!: string;

  @ApiPropertyOptional({ description: 'Print/imagem anexada, como data URI (ex: "data:image/png;base64,...")' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_IMAGE_LENGTH, { message: 'Imagem muito grande (máximo ~5MB)' })
  @Matches(/^data:image\/(png|jpe?g|gif|webp);base64,/, { message: 'Formato de imagem inválido' })
  image?: string;
}
