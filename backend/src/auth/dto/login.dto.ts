import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senhaSegura123' })
  @IsString()
  password: string;

  @ApiProperty({ required: false, description: 'Mantém a sessão ativa por mais tempo' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
