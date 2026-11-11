import { NormalizeEmail } from '../../common/utils/normalize-email';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'maria@email.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senhaSegura123' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres' })
  @MaxLength(200)
  password: string;
}
