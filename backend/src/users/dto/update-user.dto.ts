import { NormalizeEmail } from '../../common/utils/normalize-email';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Obrigatória só quando o e-mail muda' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Número do WhatsApp em formato internacional, só dígitos (ex: 5548999999999)' })
  @IsOptional()
  @Matches(/^\d{10,15}$/, { message: 'whatsappNumber deve conter só dígitos com DDI e DDD, ex: 5548999999999' })
  whatsappNumber?: string;
}
