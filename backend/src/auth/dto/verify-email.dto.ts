import { NormalizeEmail } from '../../common/utils/normalize-email';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'maria@email.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'O código deve ter 6 dígitos' })
  code: string;
}
