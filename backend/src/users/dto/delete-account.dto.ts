import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Senha atual, pra confirmar a exclusão' })
  @IsString()
  @MaxLength(200)
  password: string;
}
