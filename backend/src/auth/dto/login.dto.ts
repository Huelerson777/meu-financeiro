import { NormalizeEmail } from '../../common/utils/normalize-email';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria@email.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senhaSegura123' })
  @IsString()
  @MaxLength(200)
  password: string;

  @ApiProperty({ required: false, description: 'Mantém a sessão ativa por mais tempo' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
