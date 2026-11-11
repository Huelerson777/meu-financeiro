import { NormalizeEmail } from '../../common/utils/normalize-email';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'maria@email.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
